/**
 * watcher构造函数
 * watcher用来处理数据变化到响应的触发过程
 * vue内部的computed属性$watch, 以及v-model底层都是通过watcher来处理的
 */
/* @flow */

import { queueWatcher } from './scheduler'
import Dep, { pushTarget, popTarget } from './dep'

import {
  warn,
  remove,
  isObject,
  parsePath,
  _Set as Set,
  handleError
} from '../util/index'

import type { ISet } from '../util/index'

let uid = 0

/**
 * A watcher parses an expression, collects dependencies,
 * and fires callback when the expression value changes.
 * This is used for both the $watch() api and directives.
 */
export default class Watcher {
  vm: Component;
  expression: string;
  cb: Function;
  id: number;
  deep: boolean;
  user: boolean;

  // lazy模式，v-model.lazy, 见文档:
  // https://cn.vuejs.org/v2/guide/forms.html#lazy
  lazy: boolean;

  sync: boolean;
  dirty: boolean;
  active: boolean;
  deps: Array<Dep>;
  newDeps: Array<Dep>;
  depIds: ISet;
  newDepIds: ISet;
  getter: Function;
  value: any;

  constructor (
    vm: Component,
    expOrFn: string | Function,
    cb: Function,
    options?: Object
  ) {
    this.vm = vm

    // watcher实例push到vm实例的_watchers数组里
    vm._watchers.push(this)

    // options部分属性强制boolean型
    // options
    if (options) {
      this.deep = !!options.deep
      this.user = !!options.user
      this.lazy = !!options.lazy
      this.sync = !!options.sync
    } else {
      this.deep = this.user = this.lazy = this.sync = false
    }

    // 回调函数
    this.cb = cb

    // watcher独有uid, 从0递增
    this.id = ++uid // uid for batching

    // watcher状态，是否活跃状态
    this.active = true

    // dirty表明当前数据是不是最新的, true就是非最新，getter时需要收集依赖拿最新的值
    this.dirty = this.lazy // for lazy watchers
    this.deps = []
    this.newDeps = []
    this.depIds = new Set()
    this.newDepIds = new Set()
    this.expression = process.env.NODE_ENV !== 'production'
      ? expOrFn.toString()
      : ''

    // 设置实例的getter方法
    // parse expression for getter
    if (typeof expOrFn === 'function') {
      this.getter = expOrFn
    } else {
      // 根据watch的表达式拿到对应的属性的getter方法
      this.getter = parsePath(expOrFn)
      if (!this.getter) {
        this.getter = function () {}
        process.env.NODE_ENV !== 'production' && warn(
          `Failed watching path: "${expOrFn}" ` +
          'Watcher only accepts simple dot-delimited paths. ' +
          'For full control, use a function instead.',
          vm
        )
      }
    }

    // lazy模式值设为undefined, 否则取get函数返回值
    this.value = this.lazy
      ? undefined
      : this.get()
  }

  /**
   * 收集依赖并拿到watcher的动态value
   * Evaluate the getter, and re-collect dependencies.
   */
  get () {
    // 将当前watcher实例设为Dep.target
    pushTarget(this)
    let value
    const vm = this.vm

    // watcher的get方法执行顺序：
    // 1. 将当前工作的依赖收集器设置为当前watcher, 如果当前有正在工作的依赖收集器，将它push到的队列中
    // 2. 执行getter方法(computed|watch传入的方法)
    // 3. 拿到值之后将依赖收集器的队列pop
    // 
    // 因为整个过程是同步操作，所以不会产生额外的争夺依赖收集器的问题
    try {
      // 收集依赖执行getter方法
      value = this.getter.call(vm, vm)
    } catch (e) {
      if (this.user) {
        handleError(e, vm, `getter for watcher "${this.expression}"`)
      } else {
        throw e
      }
    } finally {
      // "touch" every property so they are all tracked as
      // dependencies for deep watching
      if (this.deep) {
        traverse(value)
      }
      popTarget()
      this.cleanupDeps()
    }
    return value
  }

  /**
   * watcher增加自身依赖的过程
   * 同时需要将自身作为订阅者胶乳到依赖的订阅者列表中
   * Add a dependency to this directive.
   */
  addDep (dep: Dep) {
    const id = dep.id
    if (!this.newDepIds.has(id)) {
      this.newDepIds.add(id)
      this.newDeps.push(dep)
      // 防止重复增加订阅， 设计了newDeps和deps两个属性
      // 收集过程中新的依赖只增加到newDeps, 收集完毕后将newDeps加入到deps中
      // 下次收集, 在deps中已经有的就不会重复订阅
      if (!this.depIds.has(id)) {
        dep.addSub(this)
      }
    }
  }

  /**
   * 清空依赖收集的队列
   * 收集变更的情况（包含第一次收集前，依赖deps为[]）
   * 结束收集后重置deps和newdeps
   * 将依赖列表更新为最新依赖情况
   * Clean up for dependency collection.
   */
  cleanupDeps () {
    let i = this.deps.length
    while (i--) {
      const dep = this.deps[i]
      if (!this.newDepIds.has(dep.id)) {
        dep.removeSub(this)
      }
    }
    let tmp = this.depIds
    this.depIds = this.newDepIds
    this.newDepIds = tmp
    this.newDepIds.clear()
    tmp = this.deps
    this.deps = this.newDeps
    this.newDeps = tmp
    this.newDeps.length = 0
  }

  /**
   * Subscriber interface.
   * Will be called when a dependency changes.
   */
  update () {
    /* istanbul ignore else */
    if (this.lazy) {
      this.dirty = true
    } else if (this.sync) {
      this.run()
    } else {
      // 添加到watcher队列
      queueWatcher(this)
    }
  }

  /**
   * watcher队列调度执行时，每个执行的watcher实际执行的方法
   * Scheduler job interface.
   * Will be called by the scheduler.
   */
  run () {
    // 只有active激活状态的watcher才执行
    if (this.active) {
      // 重新通过getter拿到值
      const value = this.get()
      if (
        value !== this.value ||
        // Deep watchers and watchers on Object/Arrays should fire even
        // when the value is the same, because the value may
        // have mutated.
        isObject(value) ||
        this.deep
      ) {
        // set new value
        const oldValue = this.value

        // 重新赋值
        this.value = value

        // 执行构造watcher时传入的回调函数
        if (this.user) {
          try {
            this.cb.call(this.vm, value, oldValue)
          } catch (e) {
            handleError(e, this.vm, `callback for watcher "${this.expression}"`)
          }
        } else {
          this.cb.call(this.vm, value, oldValue)
        }
      }
    }
  }

  /**
   * Evaluate the value of the watcher.
   * This only gets called for lazy watchers.
   */
  evaluate () {
  // lazy模式调用的方法， 初始化watcher值，执行evaluate之前，watcher的value为undefined
    this.value = this.get()
    this.dirty = false
  }

  /**
   * 计算属性A依赖于B， 在收集B的过程中， B会把自身的所有依赖加入到A中
   * Depend on all deps collected by this watcher.
   */
  depend () {
    let i = this.deps.length
    while (i--) {
      this.deps[i].depend()
    }
  }

  /**
   * Remove self from all dependencies' subscriber list.
   */
  teardown () {
    if (this.active) {
      // 如果vm实例已经开始卸载，就不需要在执行watcher移除操作
      // 卸载过程会统一处理watcher数组
      // remove self from vm's watcher list
      // this is a somewhat expensive operation so we skip it
      // if the vm is being destroyed.
      if (!this.vm._isBeingDestroyed) {
        // 将自身从vm实例的watchers数组中移除
        remove(this.vm._watchers, this)
      }

      // 循环移除依赖订阅
      let i = this.deps.length
      while (i--) {
        this.deps[i].removeSub(this)
      }

      // 置为不活跃
      this.active = false
    }
  }
}

/**
 * Recursively traverse an object to evoke all converted
 * getters, so that every nested property inside the object
 * is collected as a "deep" dependency.
 */
const seenObjects = new Set()
function traverse (val: any) {
  seenObjects.clear()
  _traverse(val, seenObjects)
}

function _traverse (val: any, seen: ISet) {
  let i, keys
  const isA = Array.isArray(val)
  if ((!isA && !isObject(val)) || !Object.isExtensible(val)) {
    return
  }
  if (val.__ob__) {
    const depId = val.__ob__.dep.id
    if (seen.has(depId)) {
      return
    }
    seen.add(depId)
  }
  if (isA) {
    i = val.length
    while (i--) _traverse(val[i], seen)
  } else {
    keys = Object.keys(val)
    i = keys.length
    while (i--) _traverse(val[keys[i]], seen)
  }
}
