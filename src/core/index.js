/**
 * 入口文件
 * 1. 引入Vue构造函数
 * 2. 添加Vue构造函数的相关静态方法(global-api)
 * 2. 为Vue示例添加$isServer, $ssrContext方法
 * 3. 添加Vue版本号占位符
 * 4. 导出Vue构造函数
 */


// 引入`Vue`构造函数
import Vue from './instance/index'
// 引入`initGlobalAPI`
import { initGlobalAPI } from './global-api/index'
//  引入`isServerRendering`方法，判断是否服务器端渲染
import { isServerRendering } from 'core/util/env'

// 初始化全局api
initGlobalAPI(Vue)

// 添加Vue.prototype.$isServer， 返回是否服务端渲染
Object.defineProperty(Vue.prototype, '$isServer', {
  get: isServerRendering
})

// 返回服务端渲染上下文
// TODO
Object.defineProperty(Vue.prototype, '$ssrContext', {
  get () {
  	// `istanbul ignore next` 用来使istanbul代码覆盖率工具计算覆盖率时忽略下一行
    /* istanbul ignore next */
    return this.$vnode && this.$vnode.ssrContext
  }
})

// Vue版本号占位符
Vue.version = '__VERSION__'

// 导出Vue
export default Vue
