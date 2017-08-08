/**
 * 数据模块
 * 导出:
 *   * stateMixin: Vue.prototype的state包装函数
 *   * initState: vue实例的state包装函数
 */

/* @flow */

import config from '../config'
import Dep from '../observer/dep'
import Watcher from '../observer/watcher'
import { isUpdatingChildComponent } from './lifecycle'

import {
  set,
  del,
  observe,
  observerState,
  defineReactive
} from '../observer/index'

import {
  warn,
  bind,
  noop,
  hasOwn,
  isReserved,
  handleError,
  nativeWatch,
  validateProp,
  isPlainObject,
  isReservedAttribute
} from '../util/index'

// defineProperty时的公用结构
// 每次使用前都重设get/set可能会是个坑
const sharedPropertyDefinition = {
  enumerable: true,
  configurable: true,
  get: noop,
  set: noop
}


// 使用Object.defineProperty重新定义属性, 设置get/set过程
export function proxy (target: Object, sourceKey: string, key: string) {
  sharedPropertyDefinition.get = function proxyGetter () {
    return this[sourceKey][key]
  }
  sharedPropertyDefinition.set = function proxySetter (val) {
    this[sourceKey][key] = val
  }
  Object.defineProperty(target, key, sharedPropertyDefinition)
}

// vue实例包装函数
// 1. 初始化实例props
// 2. 初始化实例methods
// 3. 初始化实例data
// 4. 初始化实例computed
// 5. 初始化实例watch
export function initState (vm: Component) {
  vm._watchers = []
  const opts = vm.$options

  // props初始化
  if (opts.props) initProps(vm, opts.props)

  // methods初始化
  if (opts.methods) initMethods(vm, opts.methods)

  // data没传也需要初始化，设为空对象{}， 执行监测
  if (opts.data) {
    initData(vm)
  } else {
    observe(vm._data = {}, true /* asRootData */)
  }

  // 计算属性初始化
  if (opts.computed) initComputed(vm, opts.computed)

  // watch初始化
  if (opts.watch && opts.watch !== nativeWatch) {
    initWatch(vm, opts.watch)
  }
}

// 检测数据类型
// 开发环境下如果computed/method/watch属性为空对象, 则提示warning
function checkOptionType (vm: Component, name: string) {
  const option = vm.$options[name]
  if (!isPlainObject(option)) {
    warn(
      `component option "${name}" should be an object.`,
      vm
    )
  }
}

// 初始化props函数
function initProps (vm: Component, propsOptions: Object) {
  const propsData = vm.$options.propsData || {}
  const props = vm._props = {}
  // cache prop keys so that future props updates can iterate using Array
  // instead of dynamic object key enumeration.
  const keys = vm.$options._propKeys = []
  const isRoot = !vm.$parent
  // root instance props should be converted
  observerState.shouldConvert = isRoot
  for (const key in propsOptions) {
    keys.push(key)
    const value = validateProp(key, propsOptions, propsData, vm)
    /* istanbul ignore else */
    if (process.env.NODE_ENV !== 'production') {
      if (isReservedAttribute(key) || config.isReservedAttr(key)) {
        warn(
          `"${key}" is a reserved attribute and cannot be used as component prop.`,
          vm
        )
      }
      defineReactive(props, key, value, () => {
        if (vm.$parent && !isUpdatingChildComponent) {
          warn(
            `Avoid mutating a prop directly since the value will be ` +
            `overwritten whenever the parent component re-renders. ` +
            `Instead, use a data or computed property based on the prop's ` +
            `value. Prop being mutated: "${key}"`,
            vm
          )
        }
      })
    } else {
      defineReactive(props, key, value)
    }

    // proxy定义_props
    // static props are already proxied on the component's prototype
    // during Vue.extend(). We only need to proxy props defined at
    // instantiation here.
    if (!(key in vm)) {
      proxy(vm, `_props`, key)
    }
  }
  observerState.shouldConvert = true
}

// 初始化数据函数
function initData (vm: Component) {
  // 设置vue._data
  // 如果options.data是对象，直接赋值，如果是函数，执行getData方法
  let data = vm.$options.data
  data = vm._data = typeof data === 'function'
    ? getData(data, vm)
    : data || {}
  if (!isPlainObject(data)) {
    data = {}
    process.env.NODE_ENV !== 'production' && warn(
      'data functions should return an object:\n' +
      'https://vuejs.org/v2/guide/components.html#data-Must-Be-a-Function',
      vm
    )
  }

  // proxy data on instance
  const keys = Object.keys(data)
  const props = vm.$options.props
  const methods = vm.$options.methods
  let i = keys.length
  while (i--) {
    const key = keys[i]

    // 开发环境，如果重复定义相同data和methods，则提示warning
    if (process.env.NODE_ENV !== 'production') {
      if (methods && hasOwn(methods, key)) {
        warn(
          `method "${key}" has already been defined as a data property.`,
          vm
        )
      }
    }

    // 开发环境，如果重复定义props和data相同属性，则提示warning
    if (props && hasOwn(props, key)) {
      process.env.NODE_ENV !== 'production' && warn(
        `The data property "${key}" is already declared as a prop. ` +
        `Use prop default value instead.`,
        vm
      )
    } else if (!isReserved(key)) {
      // isReserved检测key是不是以$或_开头，只有飞保留的属性，才执行proxy重新设置defineProperty
      proxy(vm, `_data`, key)
    }
  }

  // 开始观察数据
  // observe data
  observe(data, true /* asRootData */)
}

// 若options.data是对象，用该函数封装获取data过程
// 将当前实例vm作为this传给dataFn, 使得dataFn中可以直接使用实例的属性, 如props
function getData (data: Function, vm: Component): any {
  try {
    return data.call(vm)
  } catch (e) {
    handleError(e, vm, `data()`)
    return {}
  }
}

const computedWatcherOptions = { lazy: true }

// 初始化计算属性函数
function initComputed (vm: Component, computed: Object) {
  process.env.NODE_ENV !== 'production' && checkOptionType(vm, 'computed')

  // 单独开辟_computedWatchers对象，存储计算属性的watchers
  const watchers = vm._computedWatchers = Object.create(null)

  for (const key in computed) {
    const userDef = computed[key]

    // 计算属性值若不是函数，取其get值
    // 参见文档:https://cn.vuejs.org/v2/api/#computed
    const getter = typeof userDef === 'function' ? userDef : userDef.get

    // 开发环境计算属性得不到正确的getter, 报warning
    if (process.env.NODE_ENV !== 'production' && getter == null) {
      warn(
        `Getter is missing for computed property "${key}".`,
        vm
      )
    }

    // 计算属性通过watcher来实现
    // create internal watcher for the computed property.
    watchers[key] = new Watcher(vm, getter || noop, noop, computedWatcherOptions)

    // 对不在vm实例上的key, 执行defineComputed, 否则开发环境下报warning
    // component-defined computed properties are already defined on the
    // component prototype. We only need to define computed properties defined
    // at instantiation here.
    if (!(key in vm)) {
      defineComputed(vm, key, userDef)
    } else if (process.env.NODE_ENV !== 'production') {
      if (key in vm.$data) {
        warn(`The computed property "${key}" is already defined in data.`, vm)
      } else if (vm.$options.props && key in vm.$options.props) {
        warn(`The computed property "${key}" is already defined as a prop.`, vm)
      }
    }
  }
}

// 定义计算属性
export function defineComputed (target: any, key: string, userDef: Object | Function) {
  // 计算属性值为函数的情况
  if (typeof userDef === 'function') {
    // 设置计算属性的getter
    sharedPropertyDefinition.get = createComputedGetter(key)
    // 计算属性不应该有set, 使用空函数
    sharedPropertyDefinition.set = noop
  } else {
    // 计算属性是个对象情况：
    // 1. 设了get， 缓存情况下取get, 不缓存情况下重新创建getter
    // 2. 没有设get, 为空函数
    sharedPropertyDefinition.get = userDef.get
      ? userDef.cache !== false
        ? createComputedGetter(key)
        : userDef.get
      : noop
    // 计算属性对象情况下的setter设置
    sharedPropertyDefinition.set = userDef.set
      ? userDef.set
      : noop
  }

  // 开发环境下set为空函数发出warning
  if (process.env.NODE_ENV !== 'production' &&
      sharedPropertyDefinition.set === noop) {
    sharedPropertyDefinition.set = function () {
      warn(
        `Computed property "${key}" was assigned to but it has no setter.`,
        this
      )
    }
  }

  // 重新定义计算属性
  Object.defineProperty(target, key, sharedPropertyDefinition)
}

// 创建计算属性的getter
function createComputedGetter (key) {
  return function computedGetter () {
    // 得到当前计算属性的watcher
    const watcher = this._computedWatchers && this._computedWatchers[key]
    if (watcher) {
      if (watcher.dirty) {
        watcher.evaluate()
      }
      if (Dep.target) {
        watcher.depend()
      }
      return watcher.value
    }
  }
}

// 初始化methods函数
function initMethods (vm: Component, methods: Object) {
  process.env.NODE_ENV !== 'production' && checkOptionType(vm, 'methods')
  const props = vm.$options.props
  for (const key in methods) {
    // method如果是null, 设为空函数
    // 否则绑定this到vm, 加到实例上
    vm[key] = methods[key] == null ? noop : bind(methods[key], vm)

    // 开发环境下一下情况提示warning
    // 1. method值为空
    // 2. props上定一下同名属性
    if (process.env.NODE_ENV !== 'production') {
      if (methods[key] == null) {
        warn(
          `method "${key}" has an undefined value in the component definition. ` +
          `Did you reference the function correctly?`,
          vm
        )
      }
      if (props && hasOwn(props, key)) {
        warn(
          `method "${key}" has already been defined as a prop.`,
          vm
        )
      }
    }
  }
}

// 初始化watch函数
function initWatch (vm: Component, watch: Object) {
  process.env.NODE_ENV !== 'production' && checkOptionType(vm, 'watch')
  for (const key in watch) {
    const handler = watch[key]
    // watch也可以是一个数组, 如果是数组则循环遍历创建watcher
    if (Array.isArray(handler)) {
      for (let i = 0; i < handler.length; i++) {
        createWatcher(vm, key, handler[i])
      }
    } else {
      createWatcher(vm, key, handler)
    }
  }
}

// 创建watcher
// 装饰vm.$watch的参数
function createWatcher (
  vm: Component,
  keyOrFn: string | Function,
  handler: any,
  options?: Object
) {
  // 处理watch为对象的情况，见文档:
  // https://cn.vuejs.org/v2/api/#watch
  if (isPlainObject(handler)) {
    options = handler
    handler = handler.handler
  }
  // 处理watch为字符串情况, 取vm中方法
  if (typeof handler === 'string') {
    handler = vm[handler]
  }
  return vm.$watch(keyOrFn, handler, options)
}


// Vue原型链上增加:
// $data
// $props
// $set
// $delete
// $watch
export function stateMixin (Vue: Class<Component>) {
  // flow somehow has problems with directly declared definition object
  // when using Object.defineProperty, so we have to procedurally build up
  // the object here.
  const dataDef = {}
  dataDef.get = function () { return this._data }
  const propsDef = {}
  propsDef.get = function () { return this._props }
  if (process.env.NODE_ENV !== 'production') {
    dataDef.set = function (newData: Object) {
      warn(
        'Avoid replacing instance root $data. ' +
        'Use nested data properties instead.',
        this
      )
    }
    propsDef.set = function () {
      warn(`$props is readonly.`, this)
    }
  }
  Object.defineProperty(Vue.prototype, '$data', dataDef)
  Object.defineProperty(Vue.prototype, '$props', propsDef)

  Vue.prototype.$set = set
  Vue.prototype.$delete = del

  // 原型链添加$watch
  Vue.prototype.$watch = function (
    expOrFn: string | Function,
    cb: any,
    options?: Object
  ): Function {
    const vm: Component = this

    // 回调函数是对象，参数需要预处理，通过createWatcher来处理
    // 此处会递归处理
    if (isPlainObject(cb)) {
      return createWatcher(vm, expOrFn, cb, options)
    }
    options = options || {}
    options.user = true
    // 创建一个watcher, 参数: vm实例，key, 回调函数,options
    const watcher = new Watcher(vm, expOrFn, cb, options)

    // 是否立即执行watch回调
    if (options.immediate) {
      cb.call(vm, watcher.value)
    }

    // 返回解除watch函数
    return function unwatchFn () {
      watcher.teardown()
    }
  }
}
