/*
@name		:	NEM Blockchain Explorer
@version	:	0.0.3 (alpha)
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
	http://chain.nem.ninja
	/api/blocks will give you last 25 blocks
	You can use page to display 25 at a time
	/api/blocks?page=1 (last 25).
	/api/blocks?page=2 (25 before page 1)
	/api/blocks?from=1&to=100 will give you block 1 to 100
	/socket/last-block is a websocket that will pop the latest block when it's harvested.
	/api/block?hash=...
	New calls for stats: 
		/api/stats/blocktimes - will give the last 30 blocktimes
		/api/stats/harvesters - will give the top10 harvesters. 
		By default you get thoe ones with the most harvested blocks.
		You can use ?sortby=fees to get the ones with the most earnings.	
*/

// global variables
var g_htrndr	= null;		// global HTML renderer object
var g_inforndr	= null;		// global HTML block information renderer
var g_section	= "blocks";	// currently displayed page section (default = blocks)
var g_currpage	= 1;		// current display page index (1 = defult page) 
var g_running	= false;	// bool flag used to disable multiple data display actions on keyboard shortcuts
var g_web_sock	= null;		// global web socket reference

var g_socket_link 	= "ws://chain.nem.ninja/socket/last-block";
var g_api_link 		= "/api/blocks"; // local url for testing
// g_api_link = "http://chain.nem.ninja/api/blocks"; // remote url
//	"/data/data.json"; //local url for testing with static json data

var g_api_links		= {
	"blocks":	"/api/blocks",
	"tx"	:	"/api/txs",
	"stats" :	"/api/stats/harvesters"
};


var g_socket_links 	= {
	"blocks": "ws://chain.nem.ninja/socket/last-block",
	"tx"	: "ws://chain.nem.ninja/socket/last-tx"	
};


$(document).ready(function () {
	
	initMsgBox();
	initSearch();
	initNavigation();
	
	initPage();
	/*setPageSection();
	showData();
	g_web_sock = connectSocket(g_socket_link);
	*/
	
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


$(window).on('hashchange',function(evt) {
	initPage()
});


function initPage() {
	var hash = setPageSection();
	
	switch(hash) {
		
	case 'stats':
		showStats();
		break;
		
	default:
		showData();
		g_web_sock = connectSocket(g_socket_link);
		
		break;
	}
}


/*
$(window).unload(function () {
	if (! g_web_sock) return;
	g_web_sock.close();
});
*/

function setPageSection() {
	
	$("#block_info").hide();
	
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
	
	return g_section;
}


function initMsgBox() {
	$("#msgbox i").click(function(evt) {
		$("#msgbox").hide(500);
	});
}


function initSearch() {
	// search data validation pattern
	//var rex = new RegExp("^[a-zA-Z0-9]{10,}$","g");
	var rex = new RegExp("^[a-fA-F0-9]{15,}$","g");
	
	$(".srch input").keyup(function(evt) {
		
		if (evt.which != 13) return;
		if (! rex.test(this.value)) {
			showErr("Invalid search entry!");
			return;
		}
		showSearchResult(this.value);
		//showSearchResult("9e231c02266a20ca2a6629bd1f1c9066e846b8233a75b76ca5e155b03a0bdb95");
	});

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


function showStats() {

	$("#tbl").attr("class","");
	$("#tbl").addClass(g_section);	
	
	var tbl = $($("#stats").html());
	var tmpl = tbl.find("tbody").html();
	
	if (g_htrndr == null) g_htrndr = new HTMLRenderer();
	g_htrndr.setTemplate(tmpl);
	g_htrndr.addFormatter("fees", 'fmtNemValue');	
	
	
	var params = new Object();
	
	if (arguments.length == 0) {
		$("#tbl thead").html(tbl.find("thead").html());
		$("#tbl thead th").off('click').on('click',function(evt) {
			evt.preventDefault();
			var sort = $(this).data('sort');
			showStats(sort);
		});
	}
	else if (arguments[0] == "BY_FEES") {
		params["sortby"] = "fees";
		$("#tbl thead th:eq(2)").removeClass("sortable");
		$("#tbl thead th:eq(1)").addClass("sortable");
	}
	else {
		$("#tbl thead th:eq(1)").removeClass("sortable");
		$("#tbl thead th:eq(2)").addClass("sortable");
	}

	
	// load and display top 10 harvesters
	$.get(g_api_link,params).done(function(res) {
		//alert(res);
		try {
			json = JSON.parse(res);
			var html = "";
			//alert(JSON.stringify(json));
			var data = json['top10'];
			for (var i = 0;i < data.length;i++) {
				html += g_htrndr.render(data[i]);
			}
			
			$("#tbl tbody").html(html);
			
		} catch(e) {
			showErr(e.message);
		}
		
	}).fail(function(xhr, ajaxOptions, thrownError) {
		alert(xhr.status);
		alert(thrownError);
	});
	
	// load and display last 30 block times
	$.get("/api/stats/blocktimes").done(function(res) {
		//alert(res);
		try {
			json = JSON.parse(res);
			var html = "<h2>Block times:</h2>";
			//alert(JSON.stringify(json));
			var data = json['blocktimes'];
			for (var i = 0;i < data.length;i++) {
				html += data[i] + "; "; 
			}
			
			html += "<br /><h2>Top 10 Harvesters:</h2>";
			$("#block_info").html(html);
			$("#block_info").show();
			
		} catch(e) {
			showErr(e.message);
		}
		
	}).fail(function(xhr, ajaxOptions, thrownError) {
		alert(xhr.status);
		alert(thrownError);
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
	
	if (! data) {
		$("#tbl tbody").html("");
		//$("#tbl").hide();
		return;
	}
	
	var blocks = data['data'];
	//var blocks = data['top10'];
	
	// load the html tamplate
	var tbl = $($("#" + g_section).html());
	var header = tbl.find("thead").html();
	var tmpl = tbl.find("tbody").html();
	
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
	g_htrndr.addFormatter("txes", 'fmtTrans');
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
	//$("#tbl").show();
	leftResize(500);
}


function loadData(page) {

	var URL = g_api_link;
	var params = new Object();
	params['page'] = page;
	
	var json = null;
	$.ajax({
			async:false,
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


function searchData(hash) {

	var URL = "/api/block";
	var params = new Object();
	params['hash'] = hash;
	
	var json = null;
	$.ajax({
			async:false,
			method: "GET",
			data: params,
			url: URL
	}).done(function(res) {
		//alert(res);
		try {
			json = JSON.parse(res);
		} catch(e) {
			showErr("Results not found!");
			//showErr(e.message);
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


function showSearchResult(hash) {
	
	g_web_sock.close();
	var data = searchData(hash);
	
	// load the html tamplate
	var tbl = $($("#info").html());
	var tmpl = tbl.find("thead td").html();
		
	if (g_inforndr == null) g_inforndr = new HTMLRenderer();
	
	g_inforndr.setTemplate(tmpl);
	// add formatter functions for specific data value
	g_inforndr.addFormatter("txes", 'fmtTrans');
	g_inforndr.addFormatter("amount", 'fmtNemValue');
	g_inforndr.addFormatter("fee", 'fmtNemValue');
	g_inforndr.addFormatter("timestamp", 'fmtDateTime');

	var html = g_inforndr.render(data);
	
	$("#block_info").html(html);
	$("#block_info").show();
	
	tmpl = tbl.find("tbody").html();
	g_inforndr.setTemplate(tmpl);
	
	var txlist = data['txes'];
	var n = txlist.length;
	
	html = "";
	for(var i = 0;i < n;i++) {
		html += g_inforndr.render(txlist[i]);
	}
	
	$("#tbl tbody").html(html);
	$("#tbl").attr("class","");
	$("#tbl").addClass("infodata");
}


function showMsg(data) {
	return;
	alert(data);
	$("#json_data").html(data);
	$("#jdata").val(data);
}


function showErr(msg) {
	if (! msg) return;
	$("#msgbox").attr("class","");
	$("#msgbox").addClass("err");
	$("#msgbox span").html(msg);
	$("#msgbox").show(500);
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
