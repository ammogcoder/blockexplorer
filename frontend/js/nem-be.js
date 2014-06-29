/*
@name		:	NEM Blockchain Explorer
@version	:	0.0.1
 (alpha)
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
*/

// global variables
var g_htrndr = null;	// global HTML renderer object
var g_currpage = 1;		// current display page index (1 = defult page) 
var g_running = false;	// bool flag used to disable multiple data display actions on keyboard shortcuts
var g_web_sock = null;	// global web socket reference

var g_socket_link 	= "ws://92.222.0.105:8000/socket/last-block";
var g_api_link 		= "/api/blocks"; // local url for testing
// g_api_link = "http://92.222.0.105:8000/api/blocks"; // remote url
//	"/data/data.json"; //local url for testing with static json data

$(document).ready(function () {

	initNavigation();
	showData();
	g_web_sock = connectSocket(g_socket_link);
});


function initNavigation() {
	
	$(".tbl tfoot a").click(function(evt) {
		
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
		
		//var out = evt.which + ", " + g_running
		
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
	var tbl = $($("#block").html());
	var tmpl = tbl.find("tbody").html();
	
	var rend = new HTMLRenderer(tmpl);
	g_htrndr = rend;
	
	// implement custom functionality in render function
	/*
	rend.renderItem = function(html,data,key) {
		var obj = data[key];
		var plc = key == "transactions" ? obj.length : obj;
		
		return html.replace("{" + key + "}",plc);
	}
	*/
	
	// add formatter functions for specific data value
	rend.addFormatter("transactions", 'fmtTrans');
	rend.addFormatter("timestamp", 'fmtDateTime');
	
	// render the html
	var html = "";
	var n = blocks.length;
	
	for (var i = 0;i < n;i++) {
		
		var block = blocks[i];
		html += rend.render(block);
		//break;
	}
	
	$(".tbl tbody").html(html);
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


function fmtTrans(key,data) {
	var o = data[key];
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


function updateBlocks(data) {
	
	if (typeof data === "string") data = JSON.parse(data);

	var html = $(g_htrndr.render(data)).hide();
	
	$(".tbl tbody tr:eq(0)").before(html);
	html.show(750);
	$(".tbl tbody tr:gt(-3)").remove();
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
	    		if (g_currpage == 1) updateBlocks(evt.data);
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
	
	setTimeout(function() {
		var h = $(document).height();
		$(".left_sidebar").height(h);
	},time);
}