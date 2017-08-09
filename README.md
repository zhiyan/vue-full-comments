# Vue源码全注释

基于 v2.4.2版

* 保留源文件中英文注释
* 逐行添加设计思路及语法注释


###  vue实例上的私有属性
* _events: [Object] 注册的事件
* _hasHookEvent: [Boolean] 是否设置了钩子事件
* _watchers: [Array] 监测器列表

### vue实例上的属性
* $options: [Object] 实例的配置选项, 同时合并了构造函数的公共options属性
