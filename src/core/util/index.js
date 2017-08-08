/**
 * 相关工具方法
 */

/* @flow */

export * from 'shared/util'
export * from './lang'
export * from './env'
export * from './options'
export * from './debug'
export * from './props'
export * from './error'

// 属性从observer中导入， 似乎不太妥当
export { defineReactive } from '../observer/index'
