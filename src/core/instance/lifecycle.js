/**
 * 生命周期模块
 * 导出:
 *   * lifecycleMixin: Vue.prototype的生命周期包装函数
 *   * initLifecycle: vue实例的生命周期包装函数
 *   * callHook: 生命周期调用方法
 *   * mountComponent: 提供vue.prototype.$mount
 */

/* @flow */

import config from '../config'
import Watcher from '../observer/watcher'
import { mark, measure } from '../util/perf'
import { createEmptyVNode } from '../vdom/vnode'
import { observerState } from '../observer/index'
import { updateComponentListeners } from './events'
import { resolveSlots } from './render-helpers/resolve-slots'

import {
  warn,
  noop,
  remove,
  handleError,
  emptyObject,
  validateProp
} from '../util/index'

// 正在进行操作的vm实例, 属于公共资源
export let activeInstance: any = null
export let isUpdatingChildComponent: boolean = false

// 添加vue实例私有对象和属性
export function initLifecycle (vm: Component) {
  const options = vm.$options

  // 取得第一个非abstract类型的parent实例, 将当前实例加入到parent的$children数组中
  // locate first non-abstract parent
  let parent = options.parent
  if (parent && !options.abstract) {
    while (parent.$options.abstract && parent.$parent) {
      parent = parent.$parent
    }
    parent.$children.push(vm)
  }

  // 设置$parent
  vm.$parent = parent

  // $root设为最外层的vm对象实例
  // 取parent的$root属性， 若没有parent则自己就是最外层，取当前实例
  vm.$root = parent ? parent.$root : vm

  // 存储子组件的数组
  vm.$children = []

  vm.$refs = {}

  // 组件相关生命周期状态设置初始值
  vm._watcher = null
  vm._inactive = null
  vm._directInactive = false

  // 是否已经加载
  vm._isMounted = false
  // 是否已经被卸载
  vm._isDestroyed = false
  // 是否正在被卸载, 因为有异步处理
  vm._isBeingDestroyed = false
}

export function lifecycleMixin (Vue: Class<Component>) {

  // 组件更新操作
  Vue.prototype._update = function (vnode: VNode, hydrating?: boolean) {
    const vm: Component = this
    // 已经装载情况下执行beforeUpdate钩子
    if (vm._isMounted) {
      callHook(vm, 'beforeUpdate')
    }

    const prevEl = vm.$el
    const prevVnode = vm._vnode
    const prevActiveInstance = activeInstance
    activeInstance = vm
    vm._vnode = vnode

    // 对比更新
    // vm.__patch__方法在入口文件中定义，根据渲染平台的不同而有不同的实现
    // Vue.prototype.__patch__ is injected in entry points
    // based on the rendering backend used.
    if (!prevVnode) {
      // initial render
      vm.$el = vm.__patch__(
        vm.$el, vnode, hydrating, false /* removeOnly */,
        vm.$options._parentElm,
        vm.$options._refElm
      )
      // no need for the ref nodes after initial patch
      // this prevents keeping a detached DOM tree in memory (#5851)
      vm.$options._parentElm = vm.$options._refElm = null
    } else {
      // updates
      vm.$el = vm.__patch__(prevVnode, vnode)
    }
    activeInstance = prevActiveInstance
    // update __vue__ reference
    if (prevEl) {
      prevEl.__vue__ = null
    }
    if (vm.$el) {
      vm.$el.__vue__ = vm
    }
    // if parent is an HOC, update its $el as well
    if (vm.$vnode && vm.$parent && vm.$vnode === vm.$parent._vnode) {
      vm.$parent.$el = vm.$el
    }
    // updated hook is called by the scheduler to ensure that children are
    // updated in a parent's updated hook.
  }

  // 强制更新操作
  Vue.prototype.$forceUpdate = function () {
    const vm: Component = this
    // 实际执行的实例watcher的update方法
    if (vm._watcher) {
      vm._watcher.update()
    }
  }

  // vue实例销毁函数
  Vue.prototype.$destroy = function () {
    const vm: Component = this

    // 防止重复执行
    if (vm._isBeingDestroyed) {
      return
    }

    // 调用beforeDestroy的钩子
    callHook(vm, 'beforeDestroy')

    // 设置正在销毁tag
    vm._isBeingDestroyed = true

    // 将实例从父组件中移除
    // 从父组件$children数组中移除
    // 实例不能使abstract类型, 且有父组件存在
    // remove self from parent
    const parent = vm.$parent
    if (parent && !parent._isBeingDestroyed && !vm.$options.abstract) {
      remove(parent.$children, vm)
    }

    // 卸载watcher
    // teardown watchers
    if (vm._watcher) {
      vm._watcher.teardown()
    }
    let i = vm._watchers.length
    while (i--) {
      vm._watchers[i].teardown()
    }

    // remove reference from data ob
    // frozen object may not have observer.
    if (vm._data.__ob__) {
      vm._data.__ob__.vmCount--
    }

    // 设置标志位，是否已经卸载
    // call the last hook...
    vm._isDestroyed = true


    // invoke destroy hooks on current rendered tree
    vm.__patch__(vm._vnode, null)

    // 调用destroyed钩子
    // fire destroyed hook
    callHook(vm, 'destroyed')

    // 解绑所有事件监听
    // turn off all instance listeners.
    vm.$off()

    // remove __vue__ reference
    if (vm.$el) {
      vm.$el.__vue__ = null
    }
  }
}

// 对外导出的装载函数
// 只有runtime的vue才打包该函数作为vm.$mount
export function mountComponent (
  vm: Component,
  el: ?Element,
  hydrating?: boolean
): Component {
  // $el设为装载元素
  vm.$el = el

  // 如果options中没有设置render方法，则render指定为createEmptyVNode
  // render函数肯定会有，预编译的编译好后就有render, 非预编译的$mount装载时compile成render
  // 除非实时编译的，却引入了runtime版本的vue, 则在开发环境下作提示
  if (!vm.$options.render) {
    vm.$options.render = createEmptyVNode
    if (process.env.NODE_ENV !== 'production') {
      /* istanbul ignore if */
      if ((vm.$options.template && vm.$options.template.charAt(0) !== '#') ||
        vm.$options.el || el) {
        warn(
          'You are using the runtime-only build of Vue where the template ' +
          'compiler is not available. Either pre-compile the templates into ' +
          'render functions, or use the compiler-included build.',
          vm
        )
      } else {
        warn(
          'Failed to mount component: template or render function not defined.',
          vm
        )
      }
    }
  }

  // 调用beforeMount钩子
  callHook(vm, 'beforeMount')

  // 测试环境会在update前后输出一系列console, 所以与生产环境updateComponent设置不同
  let updateComponent
  /* istanbul ignore if */
  if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
    updateComponent = () => {
      const name = vm._name
      const id = vm._uid
      const startTag = `vue-perf-start:${id}`
      const endTag = `vue-perf-end:${id}`

      mark(startTag)
      const vnode = vm._render()
      mark(endTag)
      measure(`${name} render`, startTag, endTag)

      mark(startTag)
      vm._update(vnode, hydrating)
      mark(endTag)
      measure(`${name} patch`, startTag, endTag)
    }
  } else {
    // 设置更新组建函数
    updateComponent = () => {
      // vm._render() 拿到最新的VNode
      // update 进行具体的patch操作
      vm._update(vm._render(), hydrating)
    }
  }

  // 对实例开启watcher
  vm._watcher = new Watcher(vm, updateComponent, noop)
  hydrating = false

  // manually mounted instance, call mounted on self
  // mounted is called for render-created child components in its inserted hook
  if (vm.$vnode == null) {
    // 设置已装载标志位
    vm._isMounted = true
    // 调用已装载钩子
    callHook(vm, 'mounted')
  }
  return vm
}

export function updateChildComponent (
  vm: Component,
  propsData: ?Object,
  listeners: ?Object,
  parentVnode: VNode,
  renderChildren: ?Array<VNode>
) {
  if (process.env.NODE_ENV !== 'production') {
    isUpdatingChildComponent = true
  }

  // determine whether component has slot children
  // we need to do this before overwriting $options._renderChildren
  const hasChildren = !!(
    renderChildren ||               // has new static slots
    vm.$options._renderChildren ||  // has old static slots
    parentVnode.data.scopedSlots || // has new scoped slots
    vm.$scopedSlots !== emptyObject // has old scoped slots
  )

  vm.$options._parentVnode = parentVnode
  vm.$vnode = parentVnode // update vm's placeholder node without re-render

  if (vm._vnode) { // update child tree's parent
    vm._vnode.parent = parentVnode
  }
  vm.$options._renderChildren = renderChildren

  // update $attrs and $listensers hash
  // these are also reactive so they may trigger child update if the child
  // used them during render
  vm.$attrs = parentVnode.data && parentVnode.data.attrs
  vm.$listeners = listeners

  // update props
  if (propsData && vm.$options.props) {
    observerState.shouldConvert = false
    const props = vm._props
    const propKeys = vm.$options._propKeys || []
    for (let i = 0; i < propKeys.length; i++) {
      const key = propKeys[i]
      props[key] = validateProp(key, vm.$options.props, propsData, vm)
    }
    observerState.shouldConvert = true
    // keep a copy of raw propsData
    vm.$options.propsData = propsData
  }

  // update listeners
  if (listeners) {
    const oldListeners = vm.$options._parentListeners
    vm.$options._parentListeners = listeners
    updateComponentListeners(vm, listeners, oldListeners)
  }
  // resolve slots + force update if has children
  if (hasChildren) {
    vm.$slots = resolveSlots(renderChildren, parentVnode.context)
    vm.$forceUpdate()
  }

  if (process.env.NODE_ENV !== 'production') {
    isUpdatingChildComponent = false
  }
}

function isInInactiveTree (vm) {
  while (vm && (vm = vm.$parent)) {
    if (vm._inactive) return true
  }
  return false
}

// 向外提供调用组件activated钩子
export function activateChildComponent (vm: Component, direct?: boolean) {
  if (direct) {
    vm._directInactive = false
    if (isInInactiveTree(vm)) {
      return
    }
  } else if (vm._directInactive) {
    return
  }
  if (vm._inactive || vm._inactive === null) {
    vm._inactive = false
    for (let i = 0; i < vm.$children.length; i++) {
      activateChildComponent(vm.$children[i])
    }
    callHook(vm, 'activated')
  }
}

// 向外提供调用组件deactivated钩子
export function deactivateChildComponent (vm: Component, direct?: boolean) {
  if (direct) {
    vm._directInactive = true
    if (isInInactiveTree(vm)) {
      return
    }
  }
  if (!vm._inactive) {
    vm._inactive = true
    for (let i = 0; i < vm.$children.length; i++) {
      deactivateChildComponent(vm.$children[i])
    }
    callHook(vm, 'deactivated')
  }
}

// 生命周期调用方法
// @param vm 组件
// @param hook 调用的生命周期名称
// 生命周期方法都存于组件的$options中
export function callHook (vm: Component, hook: string) {

  // 从$options中拿到指定的句柄
  const handlers = vm.$options[hook]

  // 循环执行周期函数句柄, options[lifecycleName]是一个数组
  if (handlers) {
    for (let i = 0, j = handlers.length; i < j; i++) {
      try {
        handlers[i].call(vm)
      } catch (e) {
        handleError(e, vm, `${hook} hook`)
      }
    }
  }

  // 如果有钩子事件则执行钩子事件
  if (vm._hasHookEvent) {
    vm.$emit('hook:' + hook)
  }
}
