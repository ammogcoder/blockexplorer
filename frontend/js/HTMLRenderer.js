/*
@name		:	HTMLRenderer
@version	:	0.0.2
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
		var t = Hogan.compile(html);
		var tbl = $.extend({}, data, {
			fee : function() { return _formatters['fee']('fee', data); },
			amount : function() { return _formatters['amount']('amount', data); },
		});
		console.log("transation data:", data);
		html = t.render(tbl);
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
