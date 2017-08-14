/* @flow */

import type Watcher from './watcher'
import { remove } from '../util/index'

// 递增dep id
let uid = 0

/**
 * 一个依赖实例对应一个observer实例，依赖实例负责管理所有对该observer数据进行订阅的订阅者
 * 并在observer数据改变时通知订阅者进行update操作
 * A dep is an observable that can have multiple
 * directives subscribing to it.
 */
export default class Dep {
  static target: ?Watcher;
  id: number;
  subs: Array<Watcher>;

  // dep构造函数
  // subs是订阅者列表
  constructor () {
    this.id = uid++
    this.subs = []
  }

  // 增加订阅者
  // 订阅者都是watcher
  addSub (sub: Watcher) {
    this.subs.push(sub)
  }

  // 移除订阅
  removeSub (sub: Watcher) {
    remove(this.subs, sub)
  }

  // 将自己作为依赖加入到当前正在收集自己的watcher中
  depend () {
    if (Dep.target) {
      Dep.target.addDep(this)
    }
  }

  // 通知当前依赖的订阅者更新
  // watcher会依次加入到watcher队列
  notify () {
    // stabilize the subscriber list first
    const subs = this.subs.slice()
    for (let i = 0, l = subs.length; i < l; i++) {
      // 执行订阅者watcher的update方法
      subs[i].update()
    }
  }
}

// 当前正在执行的watcher
// 全局公用一个，有且仅有一个watcher在当前被执行
// the current target watcher being evaluated.
// this is globally unique because there could be only one
// watcher being evaluated at any time.
Dep.target = null

// 依赖收集器栈
const targetStack = []

// 入栈
// 如果当前有正在进行的依赖收集的watcher, 将watcher入栈
// target指向传参进来的watcher
export function pushTarget (_target: Watcher) {
  if (Dep.target) targetStack.push(Dep.target)
  Dep.target = _target
}

// 出栈
export function popTarget () {
  Dep.target = targetStack.pop()
}
