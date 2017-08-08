/**
 * 事件模块
 * 导出:
 *   * eventsMixin: Vue.prototype的events包装函数
 *   * initEvents: vue实例的events包装函数
 */

/* @flow */

import {
  tip,
  toArray,
  hyphenate,
  handleError,
  formatComponentName
} from '../util/index'
import { updateListeners } from '../vdom/helpers/index'

export function initEvents (vm: Component) {
  // 初始化设置实例_events属性
  vm._events = Object.create(null)

  // 是否有钩子事件设为false
  vm._hasHookEvent = false

  // init parent attached events
  const listeners = vm.$options._parentListeners
  if (listeners) {
    updateComponentListeners(vm, listeners)
  }
}

let target: Component

function add (event, fn, once) {
  if (once) {
    target.$once(event, fn)
  } else {
    target.$on(event, fn)
  }
}

function remove (event, fn) {
  target.$off(event, fn)
}

export function updateComponentListeners (
  vm: Component,
  listeners: Object,
  oldListeners: ?Object
) {
  target = vm
  updateListeners(listeners, oldListeners || {}, add, remove, vm)
}

export function eventsMixin (Vue: Class<Component>) {
  // 钩子事件的正则匹配
  const hookRE = /^hook:/

  // 实例$on方法
  // 参考文档: https://cn.vuejs.org/v2/api/#vm-on-event-callback
  Vue.prototype.$on = function (event: string | Array<string>, fn: Function): Component {
    const vm: Component = this
    if (Array.isArray(event)) {
      // event是数组则递归调用$on
      for (let i = 0, l = event.length; i < l; i++) {
        this.$on(event[i], fn)
      }
    } else {
      // 实例上注册的事件每一个都是一个数组
      (vm._events[event] || (vm._events[event] = [])).push(fn)

      // 判断当前时间是否是钩子事件，是钩子事件则设置实例的_hasHookEvent属性为true
      // optimize hook:event cost by using a boolean flag marked at registration
      // instead of a hash lookup
      if (hookRE.test(event)) {
        vm._hasHookEvent = true
      }
    }
    return vm
  }

  // $once方法, 实际是调用$on方法
  // 更改了事件句柄，在原句柄执行前先执行off方法解绑事件
  Vue.prototype.$once = function (event: string, fn: Function): Component {
    const vm: Component = this
    function on () {
      vm.$off(event, on)
      fn.apply(vm, arguments)
    }
    on.fn = fn
    vm.$on(event, on)
    return vm
  }

  // $off解绑事件
  Vue.prototype.$off = function (event?: string | Array<string>, fn?: Function): Component {
    const vm: Component = this

    // vm.off() 可以解绑当前实例所有的事件
    // all
    if (!arguments.length) {
      vm._events = Object.create(null)
      return vm
    }

    // events为数组，同时解绑多个事件, 递归调用
    // array of events
    if (Array.isArray(event)) {
      for (let i = 0, l = event.length; i < l; i++) {
        this.$off(event[i], fn)
      }
      return vm
    }

    // 若事件句柄为null, 说明已经解绑，不执行任何操作
    // specific event
    const cbs = vm._events[event]
    if (!cbs) {
      return vm
    }

    // vm.off(xxx) 解绑xxx
    // 设置实例xxx的事件为null
    if (arguments.length === 1) {
      vm._events[event] = null
      return vm
    }

    // 卸载某一事件多个句柄中的一个
    // specific handler
    let cb
    let i = cbs.length
    while (i--) {
      cb = cbs[i]
      if (cb === fn || cb.fn === fn) {
        cbs.splice(i, 1)
        break
      }
    }
    return vm
  }

  // 触发事件
  Vue.prototype.$emit = function (event: string): Component {
    const vm: Component = this

    // 开发环境对大小写的提示
    if (process.env.NODE_ENV !== 'production') {
      const lowerCaseEvent = event.toLowerCase()
      if (lowerCaseEvent !== event && vm._events[lowerCaseEvent]) {
        tip(
          `Event "${lowerCaseEvent}" is emitted in component ` +
          `${formatComponentName(vm)} but the handler is registered for "${event}". ` +
          `Note that HTML attributes are case-insensitive and you cannot use ` +
          `v-on to listen to camelCase events when using in-DOM templates. ` +
          `You should probably use "${hyphenate(event)}" instead of "${event}".`
        )
      }
    }

    // 循环调用句柄
    let cbs = vm._events[event]
    if (cbs) {
      cbs = cbs.length > 1 ? toArray(cbs) : cbs
      const args = toArray(arguments, 1)
      for (let i = 0, l = cbs.length; i < l; i++) {
        try {
          cbs[i].apply(vm, args)
        } catch (e) {
          handleError(e, vm, `event handler for "${event}"`)
        }
      }
    }
    return vm
  }
}
