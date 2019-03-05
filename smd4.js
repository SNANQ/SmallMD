/*
* SmallMD4 . A parser for SMD language. Compatible markdown grammar.
* Copyright (C) 2019  shanghuo
* 
* This program is free software: you can redistribute it and/or modify
* it under the terms of the GNU General Public License as published by
* the Free Software Foundation, either version 3 of the License, or
* (at your option) any later version.
* 
* This program is distributed in the hope that it will be useful,
* but WITHOUT ANY WARRANTY; without even the implied warranty of
* MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
* GNU General Public License for more details.
* 
* You should have received a copy of the GNU General Public License
* along with this program.  If not, see <https://www.gnu.org/licenses/>.
* 
* SMD由上火(shanghuo)编写，山岚幽阳网站：www.snang.cc
* SMD1版本感谢网友fmq03协助测试，SMD4版本感谢网友MFC.jar提出的非常不错的建议
* 本程序(SMD4)基于GNU General Public License v3.0协议开源
*/
function SMD4() {
    this.maxNode = 0;//最大的一个节点id值
    this.raw = [];//切割为数组的原始数据
    this.tree = { id: 0, type: 'tree', attribute: '', start: 0, end: 0, line: 0, child: [] };//树
    this.line = 0;//当前处理到的行号

    /* 运行
    * 要处理的字符串
    * 处理后的字符串
    */
    this.run = function (str) {
        this.raw = str.split("\n");
        //绘制树
        this.setTree();
        //绘制节点
        return this.printNode(this.tree);
    };

    /* 创建树
    * 无（this.raw）
    * 无（this.maxNode，this.tree，this.line）
    */
    this.setTree = function () {
        this.maxNode = 0;//最大的一个节点id值
        this.tree = { id: 0, type: 'tree', attribute: '', start: 0, end: 0, line: 0, child: [] };
        this.line = 0;
        for (this.line = 0; this.line < this.raw.length; this.line++) {
            var start = 0, nodeId = 0;
            if (this.raw[this.line].length == 0) {
                //空行
                this.addNode(nodeId, 'text', 0, start, start);
                continue;
            }
            while (this.raw[this.line].length > start) {
                var sign = this.readSign(this.raw[this.line], start);
                if (sign.type == 'code') {
                    //合并代码框区域为节点内容
                    var text = '';
                    for (this.line = this.line + 1; this.line < this.raw.length; this.line++) {
                        if (/^\s*`{3,}$/.test(this.raw[this.line])) {
                            break;
                        }
                        text += this.raw[this.line] + "\n";
                    }
                    nodeId = this.addNode(nodeId, 'code', sign.attribute, start, sign.end);
                    this.addNode(nodeId, 'text', text, 0, 0);
                    break;
                }
                if (sign.type == 'hr' || sign.type == 'hc') {
                    //制分割线
                    this.addNode(nodeId, 'hr', sign.attribute, start, sign.end);
                    break;
                }
                if (this.line + 1 < this.raw.length) {
                    var nextRowSign = this.readSign(this.raw[this.line + 1], start);
                    if (nextRowSign.type == 'table') {
                        //合并表格部为节点内容，并制表格
                        var text = this.raw[this.line].substr(start) + "\n";
                        text += this.raw[this.line + 1].substr(start) + "\n";
                        for (this.line = this.line + 2; this.line < this.raw.length; this.line++) {
                            if (/\|/.test(this.raw[this.line])) {
                                text += this.raw[this.line] + "\n";
                                continue;
                            }
                            break;
                        }
                        nodeId = this.addNode(nodeId, 'table', '', 0, 0);
                        this.setTable(nodeId, text);
                        break;
                    }
                    if (nextRowSign.type == 'hc') {
                        //制标题
                        nodeId = this.addNode(nodeId, nextRowSign.type, nextRowSign.attribute, start, start);
                        var text = this.raw[this.line].substr(start);
                        this.addNode(nodeId, 'text', text, start, start);
                        this.line++;
                        break;
                    }
                }
                if (sign.type == 'h') {
                    //制标题
                    nodeId = this.addNode(nodeId, 'h', sign.attribute, start, sign.end);
                    var text = this.raw[this.line].substr(sign.end);
                    this.addNode(nodeId, 'text', text, start, start);
                    break;
                }
                if (sign.type == 'text') {
                    //创建文本节点
                    var text = this.raw[this.line].substr(start);
                    this.addNode(nodeId, 'text', text, start, start);
                    break;
                }
                //遍历上一行标志属性判断是否合并
                var lastNodeId = this.lookupNode(nodeId, sign.type, sign.attribute, start, sign.end, this.tree);
                if (lastNodeId == nodeId) {
                    //先把节点建了，顺带更新开始位与节点id,以便再次循环
                    nodeId = this.addNode(nodeId, sign.type, sign.attribute, start, sign.end);
                }
                else {
                    //合并了
                    nodeId = lastNodeId;
                }
                start = sign.end;
            }
        }
    }

    /* 添加节点（绘制树）
    * 追加到节点id，类型，属性，标志起始位，标志结束位
    * 节点id
    */
    this.addNode = function (id, type, attribute, start, end) {
        if (type == 'text' && attribute > 0 && attribute.substr(0, 1) == "\\") {
            attribute = attribute.substr(1);
        }
        this.maxNode += 1;
        var maxNode = this.maxNode;
        var line = this.line;
        //查找要追加到的节点
        function addNodeWhile(treeNode) {
            if (treeNode.id == id) {
                treeNode.child.push({ id: maxNode, type: type, attribute: attribute, start: start, end: end, line: line, child: [] });
            }
            else {
                addNodeWhile(treeNode.child[treeNode.child.length - 1]);
            }
        }
        addNodeWhile(this.tree);
        return this.maxNode;
    }

    /* 根据行号查找节点（遍历上一行标志属性判断是否合并）
    * 目前节点id，类型，属性，标志起始位，标志结束位
    * 变动后节点id
    */
    this.lookupNode = function (id, type, attribute, start, end, treeNode) {
        if (treeNode.type == type && treeNode.attribute == attribute && treeNode.start == start && treeNode.end == end) {
            return treeNode.id;
        }
        else if (treeNode.child.length >= 1) {
            id = this.lookupNode(id, type, attribute, start, end, treeNode.child[treeNode.child.length - 1]);
        }
        if ((treeNode.type == 'ul' || treeNode.type == 'ol') && treeNode.start == start && (type == 'ul' || type == 'ol')) {
            return treeNode.id;
        }
        return id;
    }

    /* 读取一个标志（判断节点类型）
    * 行内容，标志起始位（如果为0则为首次读写）
    * 标志类型，标志属性，标志结束位
    */
    this.readSign = function (line, start) {
        var sign = line.substr(start).replace(/—/ig,'---').replace(/^(\s*)(\|?:?[-=]{3,}:?\|:?[-=]{3,}[\|:-=]*|={3,}|-{3,}|\*{3,}|`{3,}|#{1,6}|>|- \[x\]|- \[ \]|[-+·\*]|[0-9]+\.|)(\s*)(.*)$/, "$1,$2,$3,$4").split(',');
        if (/^={3,}$/.test(sign[1]) && sign[3].length == 0) {
            return {
                type: 'hc',
                attribute: '1',
                end: start + sign[0].length + sign[1].length
            }
        }
        if (/^-{3,}$/.test(sign[1]) && sign[3].length == 0) {
            return {
                type: 'hc',
                attribute: '2',
                end: start + sign[0].length + sign[1].length
            }
        }
        if (/^\*{3,}$/.test(sign[1]) && sign[3].length == 0) {
            return {
                type: 'hr',
                attribute: '',
                end: start + sign[0].length + sign[1].length
            }
        }
        if (/^`{3,}$/.test(sign[1])) {
            return {
                type: 'code',
                attribute: sign[3],
                end: start + sign[0].length + sign[1].length
            }
        }
        if (/^#{1,6}$/.test(sign[1])) {
            return {
                type: 'h',
                attribute: sign[1].length,
                end: start + sign[0].length + sign[1].length
            }
        }
        if (/^>$/.test(sign[1])) {
            return {
                type: 'blockquote',
                attribute: '',
                end: start + sign[0].length + sign[1].length
            }
        }
        if (/^- \[x\]$/.test(sign[1])) {
            return {
                type: 'checkbox',
                attribute: 'checked',
                end: start + sign[0].length + sign[1].length
            }
        }
        if (/^- \[ \]$/.test(sign[1])) {
            return {
                type: 'checkbox',
                attribute: '',
                end: start + sign[0].length + sign[1].length
            }
        }
        if (/^[-+·\*]$/.test(sign[1])) {
            if (sign[0].length >= 1 && sign[0].substr(0, 1) == "\t") {
                return {
                    type: 'ul',
                    attribute: '',
                    end: start + 1
                }
            }
            else if (sign[0].length >= 2 && sign[0].substr(1, 1) == "\t") {
                return {
                    type: 'ul',
                    attribute: '',
                    end: start + 2
                }
            }
            else if (sign[0].length >= 3) {
                return {
                    type: 'ul',
                    attribute: '',
                    end: start + 3
                }
            }
            return {
                type: 'ul',
                attribute: '',
                end: start + sign[0].length + sign[1].length
            }
        }
        if (/^[0-9]+\.$/.test(sign[1])) {
            if (sign[0].length >= 1 && sign[0].substr(0, 1) == "\t") {
                return {
                    type: 'ul',
                    attribute: '',
                    end: start + 1
                }
            }
            else if (sign[0].length >= 2 && sign[0].substr(1, 1) == "\t") {
                return {
                    type: 'ul',
                    attribute: '',
                    end: start + 2
                }
            }
            else if (sign[0].length >= 3) {
                return {
                    type: 'ul',
                    attribute: '',
                    end: start + 3
                }
            }
            else if (sign[2].length > 0) {
                return {
                    type: 'ol',
                    attribute: sign[1],
                    end: start + sign[0].length + sign[1].length
                }
            }
        }
        if (/^\|?:?[-=]{3,}:?\|:?[-=]{3,}[\|:-=]*$/.test(sign[1])) {
            return {
                type: 'table',
                attribute: sign[1],
                end: start + sign[0].length + sign[1].length
            }
        }
        return {
            type: 'text',
            attribute: sign[3],
            end: start + sign[0].length + sign[1].length
        }
    }

    /* 绘制表格
    * 表格体的id，用于建立表格的代码（文本）
    * 无（this.tree）
    */
    this.setTable = function (id, text) {
        //先把表格按行分割
        var table = text.split("\n");
        var trid = id;//存放列要合并到的id值
        var td = [];//存放列的数组
        var tdInfo = [];//存放列格式的数组
        for (var i = 0; i < table.length; i++) {
            if (table[i] == "") {
                break;
            }
            td = table[i].split('|');
            if (i != 1) {
                trid = this.addNode(id, 'tr', '', 0, 0);
            }
            //把第一行按列分割，制表头
            if (i == 0) {
                for (var j = 0; j < td.length; j++) {
                    if ((j == 0 || j == td.length - 1) && td[j] == "") {
                        continue;
                    }
                    this.addNode(trid, 'th', td[j], 0, 0);
                }
            }
            //把第二行按列分割，分析后存放为数组
            else if (i == 1) {
                for (var j = 0; j < td.length; j++) {
                    if (/^:[-—]+:$/.test(td[j])) {
                        tdInfo[j] = 'tdc';
                    }
                    else if (/^[-—]+:$/.test(td[j])) {
                        tdInfo[j] = 'tdr';
                    }
                    else if (/^:[-—]+$/.test(td[j])) {
                        tdInfo[j] = 'tdl';
                    }
                    else if (/^:?=+:?$/.test(td[j])) {
                        tdInfo[j] = 'th';
                    }
                    else {
                        tdInfo[j] = 'td';
                    }
                }
            }
            //循环后面的行按列分割，根据第二行属性绘制
            else {
                for (var j = 0; j < td.length; j++) {
                    if ((j == 0 || j == td.length - 1) && td[j] == "") {
                        continue;
                    }
                    if (tdInfo.length > j) {
                        this.addNode(trid, tdInfo[j], td[j], 0, 0);
                    }
                    else {
                        this.addNode(trid, 'td', td[j], 0, 0);
                    }
                }
            }
        }
    }

    /* 将节点绘制为HTML（传入根节点即可返回绘制的整个，这个方法内部自行递归）
    * 要处理的节点
    * 节点的内容
    */
    this.printNode = function (treeNode) {
        var str = '';
        var isP = false;
        for (var i = 0; treeNode.child.length >= i; i++) {
            if (treeNode.child.length == i) {
                if (i > 0 && isP && treeNode == this.tree) {
                    str += '</p>';
                    isP = false;
                }
                continue;
            }
            if (i > 0 && treeNode.type != 'ul' && treeNode.type != 'ol' && treeNode.child[i].type == 'text') {
                // 文本
                if (!isP && treeNode == this.tree) {
                    // 如果不存在段落
                    str += '<p>' + this.printNode(treeNode.child[i]);
                    isP = true;
                    continue;
                }
                else if (treeNode.child[i - 1].type == 'text') {
                    if (str.length > 4 && str.substr(-4) == '<br>') {
                        // 剔除多余br
                        str = str.substr(0, str.length - 4);
                    }
                    if (str.length > 6 && str.substr(-6) == '<br />') {
                        // 设置段落
                        str = str.substr(0, str.length - 6) + '</p><p>' + this.printNode(treeNode.child[i]);
                        continue;
                    }
                    str += '<br />' + this.printNode(treeNode.child[i]);
                }
            }
            else {
                if (i > 0 && isP && treeNode == this.tree) {
                    if (str.length > 3 && str.substr(-3) == '<p>') {
                        // 剔除多余br
                        str = str.substr(0, str.length - 3);
                    }
                    else {
                        str += '</p>';
                    }
                    isP = false;
                }
                if (treeNode.type == 'ul' || treeNode.type == 'ol') {
                    // 列表
                    if (treeNode.child[i].type == 'ul' || treeNode.child[i].type == 'ol') {
                        str += this.printNode(treeNode.child[i]);
                    }
                    else {
                        str += '<li>' + this.printNode(treeNode.child[i]) + '</li>';
                    }
                }
                else {
                    // 递归
                    str += this.printNode(treeNode.child[i]);
                }
            }

        }
        if (treeNode.type == 'text' && treeNode.attribute.length > 0) {
            return this.lnline(treeNode.attribute);
        }
        if (treeNode.type == 'h') {
            return '<h' + treeNode.attribute + '>' + str + '</h' + treeNode.attribute + '>';
        }
        if (treeNode.type == 'hc') {
            return '<h' + treeNode.attribute + ' style="text-align:center;">' + str + '</h' + treeNode.attribute + '>';
        }
        if (treeNode.type == 'hr') {
            return '<hr />';
        }
        if (treeNode.type == 'blockquote') {
            return '<blockquote>' + str + '</blockquote>';
        }
        if (treeNode.type == 'ul') {
            return '<ul>' + str + '</ul>';
        }
        if (treeNode.type == 'ol') {
            return '<ol start="' + treeNode.attribute + '">' + str + '</ol>';
        }
        if (treeNode.type == 'checkbox') {
            if (treeNode.attribute == 'checked') {
                return '<input type="checkbox" checked="checked" disabled="disabled" />' + str;
            }
            return '<input type="checkbox" disabled="disabled" />' + str;
        }
        if (treeNode.type == 'code') {
            return this.runCode(treeNode.child[0].attribute, treeNode.attribute);
        }
        if (treeNode.type == 'table') {
            return '<table>' + str + '</table>';
        }
        if (treeNode.type == 'tr') {
            return '<tr>' + str + '</tr>';
        }
        if (treeNode.type == 'th') {
            return '<th>' + this.lnline(treeNode.attribute) + '</th>';
        }
        if (treeNode.type == 'td') {
            return '<td>' + this.lnline(treeNode.attribute) + '</td>';
        }
        if (treeNode.type == 'tdc') {
            return '<td style="text-align:center;">' + this.lnline(treeNode.attribute) + '</td>';
        }
        if (treeNode.type == 'tdr') {
            return '<td style="text-align:right;">' + this.lnline(treeNode.attribute) + '</td>';
        }
        if (treeNode.type == 'tdl') {
            return '<td style="text-align:left;">' + this.lnline(treeNode.attribute) + '</td>';
        }
        return str;
    }

    /* 行内样式处理（包括链接与图片）
    * 待处理的字符串
    * 处理后的字符串
    */
    this.lnline = function (str) {
        //按`分割
        var lnraw = str.split('`');//10001
        var isSign = false;
        str = '';
        for (var i = 0; i < lnraw.length; i++) {
            //消耗转义
            for (; i < lnraw.length; i++) {
                if (lnraw[i].length > 2 && lnraw[i].substr(-2) == " \\") {
                    lnraw[i] = lnraw[i].substr(0, lnraw[i].length - 2) + "\\";
                }
                if (lnraw[i].length > 1 && lnraw[i].substr(-1) == ' ') {
                    lnraw[i] = lnraw[i].substr(0, lnraw[i].length - 1);
                    break;
                }
                else if (lnraw[i].substr(-1) == "\\") {
                    if (i + 1 < lnraw.length) {
                        lnraw[i + 1] = lnraw[i].substr(0, lnraw[i].length - 1) + '`' + lnraw[i + 1];
                        lnraw[i] = '';
                    }
                    else {
                        break;
                    }
                }
                else {
                    break;
                }
            }
            //判断是否标记
            if (isSign) {
                lnraw[i] = lnraw[i].replace(/ /ig, '&nbsp;');
                str += '<code>' + lnraw[i] + '</code>';
            }
            else {
                //如果不是标记，按正常转换
                //图片
                lnraw[i] = lnraw[i].replace(/(?:\[)([^\]]*?)(?:\]\()([^\)]*?)(?:\)\")([0-9]+)(?:\:)([0-9]+)(?:\")/ig, '<img src="$2" title="$1" width="$3" height="$4" />');
                lnraw[i] = lnraw[i].replace(/(?:\!\[)(.*?)(?:\]\()(.*?)(?:\))/ig, '<img src="$2" title="$1" />');
                //链接
                lnraw[i] = lnraw[i].replace(/(?:\[)([^\]]*?)(?:\]\[)([^\]]*?)(?:\]\()([^\)]*?)(?:\))/ig, '<a href="$3" title="$2">$1</a>');
                lnraw[i] = lnraw[i].replace(/(?:\[)([0-9a-z]*?)(?:\]\:\s*)([^\"]*?)(?:\s*\")([^\"]*?)(?:\")/ig, '<code>[$1]</code><a href="$2" target="_blank" title="$1" id="a$1">$3</a>');
                lnraw[i] = lnraw[i].replace(/(?:\[)(.*?)(?:\]\()(.*?)(?:\")(.*?)(?:\"\s*?\))/ig, '<a href="$2" title="$3">$1</a>');
                lnraw[i] = lnraw[i].replace(/(?:\[)(.*?)(?:\]\()(.*?)(?:\))/ig, '<a href="$2">$1</a>');
                lnraw[i] = lnraw[i].replace(/(?:\[)([^\]]*?)(?:\]\[)([0-9a-z]*?)(?:\])/ig, '<a href="#a$2" onclick=\'document.getElementById("a$2").click();\'>$1</a><code>[$2]</code>');
                //删除线
                lnraw[i] = lnraw[i].replace(/(?:~~)([^~]*?)(?:~~)/ig, '<del>$1</del>');
                //下划线
                lnraw[i] = lnraw[i].replace(/(?:\+\+)([^\+]*?)(?:\+\+)/ig, '<ins>$1</ins>');
                //上标字
                lnraw[i] = lnraw[i].replace(/(?:\^{1,2})([^\^]*?)(?:\^{1,2})/ig, '<sup>$1</sup>');
                //下标字
                lnraw[i] = lnraw[i].replace(/(?:\^{3})([^\^]*?)(?:\^{3})/ig, '<sub>$1</sub>');
                //高亮
                lnraw[i] = lnraw[i].replace(/(?:==)([^=]*?)(?:==)/ig, '<strong>$1</strong>');
                //强调
                lnraw[i] = lnraw[i].replace(/(?:\!\!)([^\!]*?)(?:\!\!)/ig, '<em>$1</em>');
                //加粗与倾斜的多种组合
                lnraw[i] = lnraw[i].replace(/(?:\*)([^\*]+?)(?:\*\*)([^\*]+?)(?:\*\*\*)/ig, '<i>$1<b>$2</b></i>');
                lnraw[i] = lnraw[i].replace(/(?:\*\*)([^\*]+?)(?:\*)([^\*]+?)(?:\*\*\*)/ig, '<b>$1<i>$2</i></b>');
                lnraw[i] = lnraw[i].replace(/(?:\*\*\*)([^\*]+?)(?:\*\*\*)/ig, '<b><i>$1</i></b>');
                lnraw[i] = lnraw[i].replace(/(?:\*\*\*)([^\*]+?)(?:\*\*)([^\*]*?)(?:\*)/ig, '<i><b>$1</b>$2</i>');
                lnraw[i] = lnraw[i].replace(/(?:\*\*\*)([^\*]+?)(?:\*)([^\*]+?)(?:\*\*)/ig, '<b><i>$1</i>$2</b>');
                lnraw[i] = lnraw[i].replace(/(?:_)([^_]+?)(?:__)([^_]+?)(?:___)/ig, '<i>$1<b>$2</b></i>');
                lnraw[i] = lnraw[i].replace(/(?:__)([^_]+?)(?:_)([^_]+?)(?:___)/ig, '<b>$1<i>$2</i></b>');
                lnraw[i] = lnraw[i].replace(/(?:___)([^_]+?)(?:___)/ig, '<b><i>$1</i></b>');
                lnraw[i] = lnraw[i].replace(/(?:___)([^_]+?)(?:__)([^_]*?)(?:_)/ig, '<i><b>$1</b>$2</i>');
                lnraw[i] = lnraw[i].replace(/(?:___)([^_]+?)(?:_)([^_]+?)(?:__)/ig, '<b><i>$1</i>$2</b>');
                //加粗
                lnraw[i] = lnraw[i].replace(/(?:\*\*)([^\*]*?)(?:\*\*)/ig, '<b>$1</b>');
                lnraw[i] = lnraw[i].replace(/(?:__)([^_]*?)(?:__)/ig, '<b>$1</b>');
                //倾斜,遇到标签或=运算符不处理
                lnraw[i] = lnraw[i].replace(/(?:\*)([^\*]*?)(?:\*)/ig, '<i>$1</i>');
                lnraw[i] = lnraw[i].replace(/([^a-zA-Z])(?:_)([^_]*?)(?:_)([^a-zA-Z])/ig, '$1<i>$2</i>$3');
                //空格的处理
                lnraw[i] = lnraw[i].replace(/  /ig, ' &nbsp;');
                str += lnraw[i];
            }
            isSign = !isSign;
        }
        return str;
    }

    /* 代码的解析或高亮
    * 待处理的代码，代码声明的语言
    * 解析后的HTML或高亮后的代码
    */
    this.runCode = function (code, lang) {
        switch (lang) {
            case '': code = this.highlight(code); break;
            case 'SMD1&2': code = this.SMDold(code); break;
            default: code = '<pre>' + code + '</pre>';
        }
        return code;
    }

    /* 几乎通用的代码高亮
    * 待处理的代码
    * 高亮后的代码
    */
    this.highlight = function (code) {
        code = code.replace(/&/ig, "&amp;").replace(/>/ig, "&gt;").replace(/</ig, "&lt;");
        code = code.replace(/([^\\])(\'\'|\"\"|\'[\s\S]*?[^\\]\'|\".*?[^\\]\")/ig, '$1<font color="#ff3333">$2</font>');
        code = code.replace(/(\n#.*)/ig, '<font color="#ff9900">$1</font>');
        code = code.replace(/(\/\/.*|\/\*(?:(?!\*\/)[\s\S])*\*\/)/ig, '<font color="#33ff33">$1</font>');
        code = code.replace(/\b(this|auto|break|case|char|const|continue|default|do|double|else|enum|extern|float(?!\:)|for|function|goto|if|int|long|register|return|short|signed|sizeof|static|struct|switch|typedef|union|unsigned|var|void|volatile|while|inline|restrict|_Bool)\b/ig, '<font color="#3366ff">$1</font>');
        return '<pre>' + code + '</pre>';
    }

    /* 旧版SMD的暴力解析（鬼知道以前版本设计为什么这么蠢）
    * 待处理的代码
    * 解析后的HTML
    */
    this.SMDold = function (code) {
        var isPre = false;
        var oldRaw = code.split("\n");
        for (var i = 0; i < oldRaw.length; i++) {
            if (isPre && oldRaw[i].substr(0, 2) != '-p') {
                oldRaw[i] = this.highlight(oldRaw[i]);
                oldRaw[i] = oldRaw[i].substr(5, oldRaw[i].length - 11);
                continue;
            }
            var lineStr = oldRaw[i].substr(2);
            var lnRaw = lineStr.split(',,');
            //x-开始是SMD2的，p=开始是SMD3的
            switch (oldRaw[i].substr(0, 2)) {
                case '-p':
                case 'p-': { if (isPre) { oldRaw[i] = '</pre>'; } else { oldRaw[i] = '<pre>'; }; isPre = !isPre }; break;
                case 'bb': oldRaw[i] = '<div>'; break;
                case 'cc': oldRaw[i] = '</div>' + lineStr; break;
                case 'l1': oldRaw[i] = '<h1 style="text-align:left;">' + lineStr + '</h1>'; break;
                case 'l2': oldRaw[i] = '<h2 style="text-align:left;">' + lineStr + '</h2>'; break;
                case '#3':
                case 'l3': oldRaw[i] = '<h3 style="text-align:left;">' + lineStr + '</h3>'; break;
                case '#4':
                case 'l4': oldRaw[i] = '<h4 style="text-align:left;">' + lineStr + '</h4>'; break;
                case '#5':
                case 'l5': oldRaw[i] = '<h5 style="text-align:left;">' + lineStr + '</h5>'; break;
                case 'l6': oldRaw[i] = '<h6 style="text-align:left;">' + lineStr + '</h6>'; break;
                case '#1':
                case 'c1': oldRaw[i] = '<h1 style="text-align:center;">' + lineStr + '</h1>'; break;
                case '#2':
                case 'c2': oldRaw[i] = '<h2 style="text-align:center;">' + lineStr + '</h2>'; break;
                case 'c3': oldRaw[i] = '<h3 style="text-align:center;">' + lineStr + '</h3>'; break;
                case 'c4': oldRaw[i] = '<h4 style="text-align:center;">' + lineStr + '</h4>'; break;
                case 'c5': oldRaw[i] = '<h5 style="text-align:center;">' + lineStr + '</h5>'; break;
                case 'c6': oldRaw[i] = '<h6 style="text-align:center;">' + lineStr + '</h6>'; break;
                case 'r1': oldRaw[i] = '<h1 style="text-align:right;">' + lineStr + '</h1>'; break;
                case 'r2': oldRaw[i] = '<h2 style="text-align:right;">' + lineStr + '</h2>'; break;
                case 'r3': oldRaw[i] = '<h3 style="text-align:right;">' + lineStr + '</h3>'; break;
                case 'r4': oldRaw[i] = '<h4 style="text-align:right;">' + lineStr + '</h4>'; break;
                case 'r5': oldRaw[i] = '<h5 style="text-align:right;">' + lineStr + '</h5>'; break;
                case '#6':
                case 'r6': oldRaw[i] = '<h6 style="text-align:right;">' + lineStr + '</h6>'; break;
                case '-|':
                case 'hr': oldRaw[i] = '<hr />' + lineStr; break;
                case '-=':
                case 'br': oldRaw[i] = '<br />' + lineStr; break;
                case 'yy':
                case '>-': oldRaw[i] = '<blockquote>' + lnRaw[0] + '</blockquote>'; break;
                case 'a-': oldRaw[i] = '<a target="_blank" href="' + lnRaw[1] + '">' + lnRaw[0] + '</a>'; break;
                case 'i-': oldRaw[i] = '<img src="' + lnRaw[0] + '" />'; break;
                case 'ia': oldRaw[i] = '<a target="_blank" href="' + lnRaw[1] + '"><img src="' + lnRaw[0] + '" /></a>'; break;
                case 'zh': { oldRaw[i] = this.highlight(lineStr); oldRaw[i] = oldRaw[i].substr(5, oldRaw[i].length - 11); }; break;
                case 'zz': oldRaw[i] = lineStr; break;
                case 'x-': oldRaw[i] = '<span>'; break;
                case 'x/':
                case '-x': oldRaw[i] = '</span>' + lineStr; break;
                case 'u=':
                case 'u-':
                case 'u[':
                case 'u]': oldRaw[i] = '<br /> · ' + lineStr; break;
                case 't-':
                case '|-': oldRaw[i] = '<pre>' + lnRaw.join("\t") + '</pre>'; break;
                case 'p=': oldRaw[i] = '<p>'; break;
                case 'p/':
                case '=p': oldRaw[i] = '</p>' + lineStr; break;
                case 'b-': oldRaw[i] = '<blockquote>'; break;
                case 'b/':
                case '-b': oldRaw[i] = '</blockquote>' + lineStr; break;
                case 'c-': oldRaw[i] = '<code>'; break;
                case 'c/':
                case '-c': oldRaw[i] = '</code>' + lineStr; break;
            }
        }
        return oldRaw.join("\n");
    }
}
