/**
 * 该文件编译出 vue.js
 * 包含runtime+compile
 * 1. 引入runtime版本vue
 * 2. 引入compile相关
 * 3. 将compile相关操作加入到runtime版本vue的$mount处理方法中
 * 4. 增加Vue.compile静态方法
 */

/* @flow */

import config from 'core/config'
import { warn, cached } from 'core/util/index'
import { mark, measure } from 'core/util/perf'

// 引入runtime版的vue构造函数
import Vue from './runtime/index'
import { query } from './util/index'
import { shouldDecodeNewlines } from './util/compat'
import { compileToFunctions } from './compiler/index'

const idToTemplate = cached(id => {
  const el = query(id)
  return el && el.innerHTML
})

// 设置$mount原型链方法
// 对runtime版本$mount做处理
// 增加了对template的编译操作
// 处理过程:
// 装载的对象如果有render方法， 说明是预编译的，只需要runtime的处理
// 如果没有render方法，就需要compile, 将模板转化为render方法
const mount = Vue.prototype.$mount
Vue.prototype.$mount = function (
  el?: string | Element,
  hydrating?: boolean
): Component {
  el = el && query(el)

  // 开发环境下提示： el元素不能使body和html
  /* istanbul ignore if */
  if (el === document.body || el === document.documentElement) {
    process.env.NODE_ENV !== 'production' && warn(
      `Do not mount Vue to <html> or <body> - mount to normal elements instead.`
    )
    return this
  }

  const options = this.$options

  // 没有render方法，则需要compile处理
  // resolve template/el and convert to render function
  if (!options.render) {
    let template = options.template
    // 指定template的情况
    if (template) {
      if (typeof template === 'string') {
        // 处理由<script>标签引入template的情况
        if (template.charAt(0) === '#') {
          // 取得script标签内文本
          template = idToTemplate(template)
          /* istanbul ignore if */
          if (process.env.NODE_ENV !== 'production' && !template) {
            warn(
              `Template element not found or is empty: ${options.template}`,
              this
            )
          }
        }
      } else if (template.nodeType) {
        // template是一个dom元素，取其innerHtml
        template = template.innerHTML
      } else {
        if (process.env.NODE_ENV !== 'production') {
          warn('invalid template option:' + template, this)
        }
        return this
      }
    } else if (el) {
      // 未指定template， 取el的outerHtml
      template = getOuterHTML(el)
    }
    if (template) {
      /* istanbul ignore if */
      if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
        mark('compile')
      }

      // 将模板编译(compile)成render函数, 并且赋值给options.render
      const { render, staticRenderFns } = compileToFunctions(template, {
        shouldDecodeNewlines,
        delimiters: options.delimiters,
        comments: options.comments
      }, this)
      options.render = render
      options.staticRenderFns = staticRenderFns

      /* istanbul ignore if */
      if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
        mark('compile end')
        measure(`${this._name} compile`, 'compile', 'compile end')
      }
    }
  }

  // 调用
  return mount.call(this, el, hydrating)
}

// 获取元素outerHTML
/**
 * Get outerHTML of elements, taking care
 * of SVG elements in IE as well.
 */
function getOuterHTML (el: Element): string {
  if (el.outerHTML) {
    return el.outerHTML
  } else {
    const container = document.createElement('div')
    container.appendChild(el.cloneNode(true))
    return container.innerHTML
  }
}

Vue.compile = compileToFunctions

export default Vue
