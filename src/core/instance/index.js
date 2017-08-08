/**
 * vue对象的构造函数定义，入口文件
 * 1. 定义Vue构造函数，内部执行_init方法
 * 2. 为Vue.prototype按模块添加一系列方法, 添加的都是原型链上的公共方法，实例私有方法在_init里面添加，模块划分:
 * 	* init: 构造函数初始化方法
 * 	* state: 数据相关
 * 	* ifecycle: 生命周期相关
 * 	* render: 渲染相关
 * 3. 导出Vue构造函数
 */

// 引入实例相关各模块
import { initMixin } from './init'
import { stateMixin } from './state'
import { renderMixin } from './render'
import { eventsMixin } from './events'
import { lifecycleMixin } from './lifecycle'
import { warn } from '../util/index'

// Vue构造函数
function Vue (options) {
	// 开发环境下如果不是使用new Vue生成实例，则提示warning
  if (process.env.NODE_ENV !== 'production' &&
    !(this instanceof Vue)
  ) {
    warn('Vue is a constructor and should be called with the `new` keyword')
  }

  // 调用内部初始化实例方法
  this._init(options)
}

// 为Vue原型链添加_init(初始化)方法
initMixin(Vue)

// 为Vue原型链添加与state相关的方法，如$data,$props,$watch等等
stateMixin(Vue)

// 为Vue原型链添加与事件相关的方法，如$on, $once, $off等等
eventsMixin(Vue)

// 为Vue原型链添加生命周期相关方法，如_update,$forceUpdate,$destroy等
lifecycleMixin(Vue)

// 为Vue原型链添加render相关方法，如_render, $nextTick等
renderMixin(Vue)

// 导出构造函数
export default Vue
