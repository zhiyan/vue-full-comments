/**
 * 用来为Vue添加全局API
 * 参见：https://cn.vuejs.org/v2/api/#全局-API
 * 文档中version在入口文件中添加，compile不在此添加，其余全局api全部在该文件添加
 */

/* @flow */
// 引入配置文件
import config from '../config'

// 引入添加use方法
import { initUse } from './use'

// 引入添加mixin方法
import { initMixin } from './mixin'

// 引入添加mixin方法
import { initExtend } from './extend'

// 引入添加component|filter|directive方法
import { initAssetRegisters } from './assets'

// 引入observer的set, del方法
import { set, del } from '../observer/index'

// 引入资源类型名数组
import { ASSET_TYPES } from 'shared/constants'

// 引入内置组件
import builtInComponents from '../components/index'

import {
  warn,
  extend,
  nextTick,
  mergeOptions,
  defineReactive
} from '../util/index'

export function initGlobalAPI (Vue: GlobalAPI) {
  // 设置Vue.config对象
  // config
  const configDef = {}
  configDef.get = () => config
  // 非生产环境的警告： Vue.config不应该被重新手动赋值
  if (process.env.NODE_ENV !== 'production') {
    configDef.set = () => {
      warn(
        'Do not replace the Vue.config object, set individual fields instead.'
      )
    }
  }
  Object.defineProperty(Vue, 'config', configDef)

  // 添加Vue.util对象，包含相关工具方法
  // 非公共api, 不建议使用
  // exposed util methods.
  // NOTE: these are not considered part of the public API - avoid relying on
  // them unless you are aware of the risk.
  Vue.util = {
    warn,
    extend,
    mergeOptions,
    defineReactive
  }

  // 添加Vue.set静态方法
  Vue.set = set

  // 添加Vue.delete静态方法
  Vue.delete = del

  // 添加Vue.nextTick静态方法
  Vue.nextTick = nextTick

  // 添加Vue.options属性
  // Vue.options = {
  //  components: {},
  //  filters: {},
  //  directives: {},
  //  _base: {Vue Constructor}
  // }
  Vue.options = Object.create(null)
  ASSET_TYPES.forEach(type => {
    Vue.options[type + 's'] = Object.create(null)
  })

  // this is used to identify the "base" constructor to extend all plain-object
  // components with in Weex's multi-instance scenarios.
  Vue.options._base = Vue

  // 扩展Vue.options.components, 添加内置组件
  extend(Vue.options.components, builtInComponents)

  // 添加Vue.use方法
  initUse(Vue)
  // 添加Vue.mixin方法
  initMixin(Vue)
  // 添加Vue.extend方法
  initExtend(Vue)
  // 添加Vue.component| Vue.filter | Vue.directive 等方法
  initAssetRegisters(Vue)
}
