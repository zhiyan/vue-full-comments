# Vue源码全注释

基于 v2.4.2版

* 保留源文件中英文注释
* 逐行添加设计思路及语法注释

### Q&A

Q. 为什么要划分core/compile/server/platforms
A. 
core作为vue内核。只是最公用最核心的内容。大概包含了Observer/vdom/Vue Constructor等等部分
compile是编译器, 将模板字符串编译成function,因为编译器比较占体积，而且不是都需要使用，一般项目构建时就进行预编译，只需要runtime的vue即可，所以compile也不放在core中。
server提供服务端渲染的相关功能，并不是所有使用者都需要，因此单独拿出来。
platforms实际包含了针对不同平台的不同打包方式，目前分了两个平台weex和web, 其中`entry-`开头的就是不同的release包，比如只有runtime的，有runtime+compile的，也有服务器渲染使用的。

Q. 为什么有那么多util文件, 而不只编写一个单一的util
A. 
已经按功能分出了许多目录，各模块对于util的需求不同, 通用的放在shared中，非通用的就在各模块自己目录中

Q. v-model/v-text/v-html等为什么不写在core里
A. 
按platform来划分，有的release包不在浏览器端运行，不一定需要这些directives, 而这些directives的规则也是按照通用directives写法来实现，因此作为单独的依赖，不作为core中的内容。
