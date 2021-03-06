/**
 * 实例化一个vue对象，实际执行的方法: Vue.protoype._init
 */

/* @flow */

import config from '../config'
// proxy只是开发环境中用到
import { initProxy } from './proxy'
import { initState } from './state'
import { initRender } from './render'
import { initEvents } from './events'
import { mark, measure } from '../util/perf'
import { initLifecycle, callHook } from './lifecycle'
import { initProvide, initInjections } from './inject'
import { extend, mergeOptions, formatComponentName } from '../util/index'

let uid = 0

export function initMixin (Vue: Class<Component>) {
  Vue.prototype._init = function (options?: Object) {
    const vm: Component = this

    // 为每一个vue实例设置独有的uid, 递增
    // a uid
    vm._uid = uid++

    let startTag, endTag
    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
      startTag = `vue-perf-init:${vm._uid}`
      endTag = `vue-perf-end:${vm._uid}`
      mark(startTag)
    }

    // a flag to avoid this being observed
    vm._isVue = true

    // 合并options
    // options._isComponent在vdom中定义，标识是否是组件
    // 组件执行initInternalComponent
    // 非组件执行mergeOptions->resolveConstructorOptions
    // merge options
    if (options && options._isComponent) {
      // optimize internal component instantiation
      // since dynamic options merging is pretty slow, and none of the
      // internal component options needs special treatment.
      initInternalComponent(vm, options)
    } else {
      // 设置实例的$options
      vm.$options = mergeOptions(
        resolveConstructorOptions(vm.constructor),
        options || {},
        vm
      )
    }

    /* istanbul ignore else */
    if (process.env.NODE_ENV !== 'production') {
      initProxy(vm)
    } else {
      // 非开发环境renderProxy指向实例自己
      vm._renderProxy = vm
    }

    // 设置一个实例自身的引用
    // expose real self
    vm._self = vm

    // 添加实例生命周期方法
    initLifecycle(vm)

    // 添加事件方法
    initEvents(vm)

    // 添加render方法
    initRender(vm)

    // 执行beforeCreate生命周期函数
    callHook(vm, 'beforeCreate')

    // 依赖注入
    // 参考文档: https://cn.vuejs.org/v2/api/#provide-inject
    // 主要给插件和组件库使用
    initInjections(vm) // resolve injections before data/props

    // 初始化数据相关, data/props
    initState(vm)

    // 同inject
    initProvide(vm) // resolve provide after data/props

    // 执行created生命周期函数
    callHook(vm, 'created')

    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
      vm._name = formatComponentName(vm, false)
      mark(endTag)
      measure(`${vm._name} init`, startTag, endTag)
    }

    // 如果options中设置了el, 则装载el
    // $mount在最外层runtime中定义，根据平台不同有实现区别
    if (vm.$options.el) {
      vm.$mount(vm.$options.el)
    }
  }
}

// 如果实例是一个component, 则执行该方法，设置一系列options
function initInternalComponent (vm: Component, options: InternalComponentOptions) {
  const opts = vm.$options = Object.create(vm.constructor.options)
  // doing this because it's faster than dynamic enumeration.
  opts.parent = options.parent
  opts.propsData = options.propsData
  opts._parentVnode = options._parentVnode
  opts._parentListeners = options._parentListeners
  opts._renderChildren = options._renderChildren
  opts._componentTag = options._componentTag
  opts._parentElm = options._parentElm
  opts._refElm = options._refElm
  if (options.render) {
    opts.render = options.render
    opts.staticRenderFns = options.staticRenderFns
  }
}


// 拿到Vue构造函数的公共options
export function resolveConstructorOptions (Ctor: Class<Component>) {
  // 得到构造函数的静态属性options
  // 该属性在global-api中添加
  let options = Ctor.options

  // 是否继承了父级Class
  // 比如通过Vue.extend方法创造的实例
  // 继承了父级Class, 则super指向父级构造函数，此处拿到父级构造函数的options
  // 做了cache判断，如果已经有superOptions属性，说明已经将父级options赋给过当前Class
  // 如果没有，则将父级options赋给当前构造函数的superOptions属性
  if (Ctor.super) {
    const superOptions = resolveConstructorOptions(Ctor.super)
    const cachedSuperOptions = Ctor.superOptions
    if (superOptions !== cachedSuperOptions) {
      // super option changed,
      // need to resolve new options.
      Ctor.superOptions = superOptions
      // check if there are any late-modified/attached options (#4976)
      const modifiedOptions = resolveModifiedOptions(Ctor)
      // update base extend options
      if (modifiedOptions) {
        extend(Ctor.extendOptions, modifiedOptions)
      }
      // 合并extendOptions和父级options作为当前构造函数的options
      options = Ctor.options = mergeOptions(superOptions, Ctor.extendOptions)

      // 如果设置了组件名，在options.components组件列表中添加引用
      if (options.name) {
        options.components[options.name] = Ctor
      }
    }
  }

  return options
}


// 以下两个函数都是为解决#4976，额外对options做的处理
function resolveModifiedOptions (Ctor: Class<Component>): ?Object {
  let modified
  const latest = Ctor.options
  const extended = Ctor.extendOptions
  const sealed = Ctor.sealedOptions
  for (const key in latest) {
    if (latest[key] !== sealed[key]) {
      if (!modified) modified = {}
      modified[key] = dedupe(latest[key], extended[key], sealed[key])
    }
  }
  return modified
}

function dedupe (latest, extended, sealed) {
  // compare latest and sealed to ensure lifecycle hooks won't be duplicated
  // between merges
  if (Array.isArray(latest)) {
    const res = []
    sealed = Array.isArray(sealed) ? sealed : [sealed]
    extended = Array.isArray(extended) ? extended : [extended]
    for (let i = 0; i < latest.length; i++) {
      // push original options and not sealed options to exclude duplicated options
      if (extended.indexOf(latest[i]) >= 0 || sealed.indexOf(latest[i]) < 0) {
        res.push(latest[i])
      }
    }
    return res
  } else {
    return latest
  }
}
