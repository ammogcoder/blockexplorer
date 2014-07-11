/*
@name		:	NEM Blockchain Explorer
@version	:	0.0.2 (alpha)
@author		:	freigeist
@licence	:	
@copyright	:	2014->, freigeist
@contact	:	
@credits	:	
@description:
	NEM Blockchain Explorer

@notes		:
	alright - for now the api works again.
	http://92.222.0.105:8000
	/api/blocks will give you last 25 blocks
	You can use page to display 25 at a time
	/api/blocks?page=1 (last 25).
	/api/blocks?page=2 (25 before page 1)
	/api/blocks?from=1&to=100 will give you block 1 to 100
	/socket/last-block is a websocket that will pop the latest block when it's harvested.
	/api/block?hash=...
	
*/

// global variables
var g_htrndr	= null;		// global HTML renderer object
var g_section	= "blocks";	// currently displayed page section (default = blocks)
var g_currpage	= 1;		// current display page index (1 = defult page) 
var g_running	= false;	// bool flag used to disable multiple data display actions on keyboard shortcuts
var g_web_sock	= null;		// global web socket reference

var g_socket_link 	= "ws://92.222.0.105:8000/socket/last-block";
var g_api_link 		= "/api/blocks"; // local url for testing
// g_api_link = "http://92.222.0.105:8000/api/blocks"; // remote url
//	"/data/data.json"; //local url for testing with static json data

var g_api_links		= {
	"blocks":	"/api/blocks",
	"tx"	:	"/api/tx"
};


var g_socket_links 	= {
	"blocks": "ws://92.222.0.105:8000/socket/last-block",
	"tx"	: "ws://92.222.0.105:8000/socket/last-tx"	
};


$(document).ready(function () {
	
	initNavigation();
	setPageSection();
	showData();
	g_web_sock = connectSocket(g_socket_link);
	
/* temp test code for manual socket testing
	$(".logo a").click(function(evt) {
			evt.preventDefault();
			var data = $("#json_data").html();
			updateData(data);
	});
*/

});


$(window).on('beforeunload',function(evt){
	if (! g_web_sock) return;
	g_web_sock.close();
});


$(window).on('hashchange',function(evt){
	setPageSection();
	showData();
	g_web_sock = connectSocket(g_socket_link);
});

/*
$(window).unload(function () {
	if (! g_web_sock) return;
	g_web_sock.close();
});
*/

function setPageSection() {
	
	var hash = document.location.hash;
	if (! hash || hash.length <= 1) g_section = "blocks";
	else g_section = hash.substring(1);
	
	// close the socket connection if is already open
	if (g_web_sock != null) g_web_sock.close();
	
	// reset the page index to 1
	g_currpage = 1;

	g_api_link = g_api_links[g_section];
	g_socket_link = g_socket_links[g_section];
	
	//set selected menu link
	$(".selected").removeClass("selected");
	$("a[href='/#" + g_section + "']").parent("li").addClass("selected");
	
	$("#tbl").attr("class","");
	$("#tbl").addClass(g_section);
}


function initNavigation() {
	
	$("#tbl tfoot a").click(function(evt) {
		
		evt.preventDefault();
		var index = $(this).data('page');
		
		if (index == 0)
			g_currpage = 1;
		else 
			g_currpage += index;
		
		if (g_currpage <= 0) {
			g_currpage = 1;
			g_running = false;
			return;
		}
		
		showData(g_currpage);
	});
	
	
	// init keybeord arrow navigation shortcuts
	$(document).keyup(function(evt) {
		
		evt.preventDefault();
		if (g_running) return;
		
		switch(evt.which) {
			case 37:	// arrow left 
				g_running = true;
				$(".prev").click();				
				break;
			case 39:	// arrow right
				g_running = true;
				$(".next").click();
				break;
		}
	});
}


function showData() {
	
	var page = 1;
	if (arguments.length == 1) {
		page = parseInt(arguments[0]);
		if (isNaN(page)) page = 1;
	}
	
	var data = loadData(page);
	renderData(data);
	
	// set timeout of 0.5 sec to avoid multiple requests because 
	// the key up event is triggered multiple times for one stroke
	setTimeout(function() {
		g_running = false;
	} ,500);
	
}


function renderData(data) {
	
	var blocks = data['data'];
	
	// load the html tamplate
	//var tbl = $($("#blocks").html());
	var tbl = $($("#" + g_section).html());
	var header = tbl.find("thead").html();
	var tmpl = tbl.find("tbody").html();
	
	//$("#tbl").
	$("#tbl thead").html(header);
	
	if (g_htrndr == null)
		g_htrndr = new HTMLRenderer(tmpl);
	else 		
		g_htrndr.setTemplate(tmpl);
	
	// implement custom functionality in render function
	/*
	rend.renderItem = function(html,data,key) {
		var obj = data[key];
		var plc = key == "transactions" ? obj.length : obj;
		
		return html.replace("{" + key + "}",plc);
	}
	*/
	
	// add formatter functions for specific data value
	g_htrndr.addFormatter("transactions", 'fmtTrans');
	g_htrndr.addFormatter("timestamp", 'fmtDateTime');
	g_htrndr.addFormatter("amount", 'fmtNemValue');
	g_htrndr.addFormatter("fee", 'fmtNemValue');	
	
	// render the html
	var html = "";
	var n = blocks.length;
	
	for (var i = 0;i < n;i++) {
		
		var block = blocks[i];
		html += g_htrndr.render(block);
		//break;
	}
	
	$("#tbl tbody").html(html);
	leftResize(500);
}


function loadData(page) {

	var URL = g_api_link;
	
	var params = new Object();
	params['page'] = page;
	
	var json = null;
	$.ajax({
			async:false,
			/* test jsonp
			dataType: "jsonp",
			jsonp: "callback",
			contentType: "application/json; charset=utf-8;",
			jsonpCallback: "getData",
			crossDomain: true, */
			method: "GET",
			data: params,
			url: URL
	}).done(function(res) {
		//alert(res);
		try {
			json = JSON.parse(res);
		} catch(e) {
			showErr(e.message);
		}
		
	}).fail(function(xhr, ajaxOptions, thrownError) {
		alert(xhr.status);
		alert(thrownError);
	}).always(function() {
		//g_running = false;
	});
	
	return json;
}


function fmtNemValue(key,data) {
	var o = data[key];
	if (! o) return "0.000000";
	
	o = "" + o;
	var pos = o.length - 6;
	
	o = o.substring(0,pos) + "." + o.substring(pos);
	if (o.indexOf('.') === 0) o = '0' + o;
	return o;
}


function fmtTrans(key,data) {
	var o = data[key];
	if (! o) return 0;
	return o.length;
}


function fmtDateTime(key,data) {
	return toLocalDateTime(data[key]);
}


function toLocalDateTime(utc_timestamp) {
	
	var datetime = utc_timestamp.split(' ');
	var dp = datetime[0].split('-');
	dp = dp.concat(datetime[1].split(':'));
	
	var date = new Date(Date.UTC(dp[0],dp[1]-1,dp[2],dp[3],dp[4],dp[5]));
	
	datetime[0] = date.toLocaleDateString();
	datetime[1] = date.toLocaleTimeString();
	
	datetime = datetime.join(' ');
	
	return datetime;
}


function getData(data) {
	return data;
}


/*
function _updateData(data) {

	if (typeof data === "string") data = JSON.parse(data);

	var html = $(g_htrndr.render(data)).hide();

	$("#tbl tbody tr:eq(0)").before(html);
	html.show(750);
	$("#tbl tbody tr:gt(-3)").remove();
	leftResize(750);
}
*/

function updateData(data) {
	if (typeof data === "string") data = JSON.parse(data);

	var html = $(g_htrndr.render(data)).hide();
	html.addClass("newdata");

	$("#tbl tbody tr:eq(0)").before(html);
		
	html.show(500).delay(250).animate({backgroundColor: '#f7f7f7'},1000);	
	setTimeout(function() { 
		html.removeClass("newdata");
		html.removeAttr("style");
	},2500);
	
	$("#tbl tbody tr:gt(-3)").remove();
	leftResize(750);	
}


function connectSocket(url) {
	
	var wsocket = null;
	
    if (window.WebSocket) wsocket = new WebSocket(url);
    else if (window.MozWebSocket) wsocket = new MozWebSocket(url);
    else {
        showErr("WebSocket Not Supported");
        return;
    }
    
    if (wsocket == null) return;
    
	try {

	    wsocket.onopen 		= function(evt) { showMsg("socket is open"); }
	    wsocket.onmessage 	= function(evt) { 
	    	//showMsg(evt.data);
	    	try {
	    		// update only if last 25 block are displayed
	    		if (g_currpage == 1) updateData(evt.data);
	    	}catch(ex) {
	    		showErr(ex.message);
	    	}
	    }
	    
	    wsocket.onclose 	= function(evt) { showMsg("socket has been closed!!"); };
	    wsocket.onerror 	= function(evt) { 
	    	showErr(evt.data);
	    	wsocket.close();
	    }
	} catch(e) { showErr(e.message); }
	
	return wsocket;
}


function showMsg(data) {
	return;
	alert(data);
	$("#json_data").html(data);
	$("#jdata").val(data);
}


function showErr(msg) {
	//alert(msg);
	//console.log(msg);
}


function leftResize(time) {
	return;
	setTimeout(function() {
		var h = $(document).height();
		$(".left_sidebar").height(h);
	},time);
}
