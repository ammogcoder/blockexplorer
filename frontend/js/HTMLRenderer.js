/*
@name		:	HTMLRenderer
@version	:	0.0.1
@author		:	freigeist
@licence	:	
@copyright	:	2014->, freigeist
@contact	:	
@credits	:	
@Description:
	Helper object to render (fill)
	HTML templates from JSON data objects
*/

function HTMLRenderer(tmpl) {
	
	var _self = this;
	var _html_tmpl = tmpl;	// html template 	
	var _formatters = new Object();
	
	
	this.setTemplate = function(tmpl) {
		_html_tmpl = tmpl;
	};
	
	
	this.render = function(data) {
		
		var html = _html_tmpl;		
		var rex = RegExp("\\{\\w+\\}","gi");
		var plc = html.match(rex); // find palce holders in template example: {variable_name}
		var n = plc.length;
		
		for (var i = 0;i < n;i++) {
			var key = plc[i].substring(1);
			key = key.substring(0,key.length-1);
			html = _self.renderItem(html,data,key);
		}
				
		return html;
	};
	
	
	this.renderItem = function(html,data,key) {
		// implement functionality here
		//return html.replace("{" + key + "}",data[key]);
		
		var obj = (! _formatters[key]) ? 
			data[key] : window[_formatters[key]](key,data);
			
		return html.replace("{" + key + "}",obj);	
	};
	
	
	this.addFormatter = function(key,fn) {
		_formatters[key] = fn;
	};
	
	
	this.rmvFormatter = function(key) {
		delete _formatters[key];
	};
}
