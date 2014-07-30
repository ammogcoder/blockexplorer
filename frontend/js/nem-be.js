/*
@name		:	NEM Blockchain Explorer
@version	:	0.0.7 (alpha)
@author		:	freigeist
@licence	:	
@copyright	:	2014->, freigeist
@contact	:	
@credits	:	
@description:
	NEM Blockchain Explorer

@notes		:
	alright - for now the api works again.
	http://92.222.0.105
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
	
	/api/account?address=xxx
	** /api/transfers?address=xxx **
	
	/api/search?q=...
*/

// global variables
var g_rex		= null;		// global serch validation regexp object
var g_htrndr	= null;		// global HTML renderer object
var g_inforndr	= null;		// global HTML block information renderer
var g_section	= "blocks";	// currently displayed page section (default = blocks)
var g_currpage	= 1;		// current display page index (1 = defult page) 
var g_running	= false;	// bool flag used to disable multiple data display actions on keyboard shortcuts
var g_web_sock	= null;		// global web socket reference
var g_chart		= null;		// global chart reference (block times chart)

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

var g_chart_calc = null;
var g_chart_data = {
	labels : [],
	datasets : [
		{
			label : "Block times",
            fillColor: "rgba(220,220,220,0.2)",
            strokeColor: "rgba(220,220,220,1)",
            pointColor: "rgba(220,220,220,1)",
            pointStrokeColor: "#fff",
            pointHighlightFill: "#fff",
            pointHighlightStroke: "rgba(220,220,220,1)",
			data : []
		},
		{
			label : "Avg. block time",
            fillColor: "rgba(151,87,205,0.2)",
            strokeColor: "rgba(151,87,205,1)",
            pointColor: "rgba(151,87,205,1)",
            pointStrokeColor: "#fff",
            pointHighlightFill: "#fff",
            pointHighlightStroke: "rgba(151,187,205,1)",
			data : []
		}
	]
};



$(document).ready(function () {
	
	initMsgBox();
	initSearch();
	initInfoBox();
	initInfoLinks();
	initNavigation();
	initChartBlocksSelect();
	
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
	
	//$("#block_info").hide();
	$("#chart_info").hide();
	
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


function initInfoBox() {
	$("#info_box > h3").click(function(evt) {
		$("#overlay").hide();
		$("body").removeClass("overlay");
		//$("#tbl").show();
	});
	
	$("#overlay").click(function(evt) {
			
		if (evt.target.id != "overlay") return;
		
		$("#overlay").hide();
		$("body").removeClass("overlay");
		//$("#tbl").show();
	});
}


function initInfoLinks() {
	
	$("#tbl tbody").click(function(evt) {
		
		evt.preventDefault();	
		if (evt.target.tagName != "A") return;	
		var acc = $(evt.target).data('account');
		showAccount(acc);
		
	});
}


function initSearch() {
	// search data validation pattern
	//var rex = new RegExp("^[a-zA-Z0-9]{10,}$","g");
	if (g_rex == null)
		g_rex = new RegExp("^[a-zA-Z0-9]{15,}$","g");
	
	$(".srch input").keyup(function(evt) {
		
		if (evt.which != 13) return;
		
		var val = $.trim(this.value);
		g_rex.lastIndex = 0;
		if (! g_rex.test(val)) {
			showErr("Invalid search entry!");
			alert(val);
			return;
		}
		showSearchResult(val);
		//showSearchResult("04e6da77dcaa7fac14293027583d0da7dd2cfd5c8e49cd7d118cb5075e67dd7a");
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


function initChartBlocksSelect() {
	
	$("#chart_info select").change(function(evt) {
		evt.preventDefault();
		var chart_data = getChartBlockRange(this.value);
		showChart(chart_data);
	});
	
}


function getChartBlockRange(range) {

	var range = range.split(',');
	range[0] = parseInt(range[0]);
	range[1] = parseInt(range[1]);
	
	var chart_data = $.extend({}, g_chart_calc);
	
	chart_data['lbl'] = chart_data['lbl'].slice(range[0]-1,range[1]-1);	// labels 
	chart_data['tme'] = chart_data['tme'].slice(range[0]-1,range[1]-1);	// block times values
	chart_data['avg'] = chart_data['avg'].slice(range[0]-1,range[1]-1);
	
	return chart_data;
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
	
	
	if (arguments.length > 0) return;
	
	// load and display last 30 block times
	$.get("/api/stats/blocktimes").done(function(res) {
		//alert(res);
		try {
			json = JSON.parse(res);
			var data = json['blocktimes'];
			g_chart_calc = calcAvgBT(data);
			data = getChartBlockRange($("#chart_info select").val());
			showChart(data);

		} catch(e) {
			showErr(e.message);
		}

		
	}).fail(function(xhr, ajaxOptions, thrownError) {
		alert(xhr.status);
		alert(thrownError);
	});	
	
}


function showChart(data) {
	
	var chart_data = data;

	g_chart_data.labels = chart_data['lbl'];			// labels 1 - 60 
	g_chart_data.datasets[0].data = chart_data['tme'];	// block times values
	g_chart_data.datasets[1].data = chart_data['avg'];	// average block time values
	
	
	var ctx = $("#canvas").get(0).getContext("2d");
	
	g_chart = new Chart(ctx).Line(g_chart_data, {
		animation	: false,
		responsive 	: false,
		bezierCurve : false,
		datasetFill : false,
		pointDot	: false,
		pointDotRadius	: 2,
		showTooltips	: false,
		/*
		scaleOverride : true,
		scaleSteps: 5,
		scaleLabel : "<%=value%>",
		scaleStepWidth: 30
		*/
	});	
	//g_chart.update();

	
	$("#canvas").off('click');
	$("#canvas").click(function(evt) {
		showChartTooltip(g_chart,evt,chart_data);
	});
	

	$("#canvas").off('mousemove');
	$("#canvas").mousemove(function(evt) {
		showChartTooltip(g_chart,evt,chart_data);
	});

	
	$("#canvas").off('mouseout');
	$("#canvas").mouseout(function(evt) {
		$("#chart_tool_tip").hide();
	});
	
	$("#chart_info").show();
	
}


function showChartTooltip(chart,evt,data) {

	var group 			= "";
	var datapoints 		= new Array();
	var activePoints  	= chart.getPointsAtEvent(evt);

	// extract last active point for each dataset
	for (var i = 0;i < activePoints.length;i++) {
		
		if (activePoints[i].datasetLabel != group) {
			
			datapoints.push(activePoints[i]);
			group = activePoints[i].datasetLabel;
		}
	}
	
	if (! datapoints[0]) {
		$("#chart_tool_tip").hide();
		return;
	}
	
	var indx = data["height"].length - parseInt(datapoints[0].label);
	//var indx = parseInt(datapoints[0].label)-1;
	
	var html = "Block / Height:<br />";
		html += "<b>" + datapoints[0].label + " / " + data["height"][indx] + "</b><br />";
	for (var i = 0;i < datapoints.length;i++) {
		html += " <i class=\"fa fa-square\" style=\"color:" + datapoints[i].fillColor + "\"></i> " + Math.round(datapoints[i].value,2);
	}
	
	var offset = $(evt.target).offset();
	var posX = (evt.pageX - offset.left) + 30;
	var posY = (evt.pageY - offset.top) + 30;
	
	$("#chart_tool_tip").html(html);
	$("#chart_tool_tip").css("left",posX + "px");
	$("#chart_tool_tip").css("top",posY + "px");
	$("#chart_tool_tip").show();
}


function calcAvgBT(data) {
	
	var blocks = data; 
	var keys = Object.keys(blocks);
	var len = keys.length;
	
	data = new Array();
	keys.sort(sortByBlockHeight);
	
	for (var i = 0;i < len;i++) {
		var key = keys[i];
		data.push(blocks[key]);
	}

	
	var nblocks = data.length;
	var n = nblocks / 2;
	
	var labels = new Array();
	var avg_per_block = new Array(n);
	
	// convert to all block times to seconds	
	for (var i = 0;i < nblocks;i++) {
		data[i] = data[i] / 1000;
		if (i < n) {
			var j = i+1;
			
			labels.push(j);
			//if (j % 5 == 0 || j == 1) labels.push(j);
			//else labels.push("");
		}
	}
	
	n = nblocks / 2;
	var j = 0;
	var limit = n + j;
	
	// calculate averages for last n blocks
	for (var i = 0;i < n;i++) {

		j = i;
		limit = j + n;
		avg_per_block[j] = 0;
		
		for (var j = i;j < limit;j++) avg_per_block[i] += data[j];
				
		avg_per_block[i] = avg_per_block[i] / n; 
	}
	
	data = data.reverse();
	labels = labels.reverse();
	avg_per_block = avg_per_block.reverse();
	keys = keys.slice(0,avg_per_block.length).reverse();	
	
	return { "tme" : data, "lbl" : labels, "avg" : avg_per_block, "height" : keys };
}


function sortByBlockHeight(a,b) {
	a = parseInt(a);
	b = parseInt(b);
	
	return a > b ? -1 : 1;
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
	
	// load the html tamplate
	var tbl = $($("#" + g_section).html());
	var header = tbl.find("thead").html();
	var tmpl = tbl.find("tbody").html();
	
	$("#tbl thead").html(header);
	
	if (g_htrndr == null)
		g_htrndr = new HTMLRenderer(tmpl);
	else 		
		g_htrndr.setTemplate(tmpl);
	
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

	//var URL = "/api/block";
	var URL = "/api/search";
	var params = new Object();
	//params['hash'] = hash;
	params['q'] = hash;
	
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


function showAccount(address) {
	
	var URL = "/api/account";
	var params = new Object();
	params["address"] = address;
	
	// /api/account?address=TBLOODZW6W4DUVL4NGAQXHZXFQJLNHPDXHULLHZW

	$.ajax({
			async	:	true,
			method	:	"GET",
			data	: 	params,
			url		: 	URL
	}).done(function(res) {
		//alert(res);
		try {
			
			json = JSON.parse(res);
			//var data = json['account'];
			showAccountInfo(json);
			
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
}


function showAccountInfo(data) {
	
	var tmpdata = data;
	
	data = tmpdata['account'];
	
	data['status'] = tmpdata['meta']['status'];
	data['height'] = data['importance']['height'];
	data['page_rank'] = data['importance']['page-rank'];
	data['score'] = data['importance']['score'];
	
	if (g_inforndr == null) g_inforndr = new HTMLRenderer();
	
	var tmpl = $("#account").html();
	
	g_inforndr.setTemplate(tmpl);
	// add formatter functions for specific data value
	g_inforndr.addFormatter("messages", 'fmtTrans');
	g_inforndr.addFormatter("balance", 'fmtNemValue');
	
	$("#info_box span").html(g_inforndr.render(data));
	$("#overlay").show();
	$("body").addClass("overlay");
	
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
	
	//console.log = utc_timestamp;
	if (! utc_timestamp) return utc_timestamp;
	
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
	
	var tbl = null;
	var tmpl = null;
	//var obj_type = ! data["height"] ? 'tx' : 'block';
	var obj_type = null;
	
	obj_type = (! obj_type) && (! data["block"]) ? null : 'tx';
	if (obj_type == null) obj_type = (! data["account"]) ? null : 'account';
	if (obj_type == null) obj_type = (! data["height"])  ? null : 'block';
	
	alert(obj_type);	
	
	if (obj_type == 'account') {
		showAccountInfo(data);
		return;
	} 
	
	// load the html tamplate
	if (obj_type == 'block') {
		tbl = $($("#info").html());
		tmpl = tbl.find("thead td").html();
	}
	else {
		tbl = $($("#txinfo").html());
		tmpl = tbl.find("tbody td").html();
		//$("#tbl").hide();
	}
	
	/*
	json = JSON.parse(res);
	var data = json['account'];
	showAccountInfo(data);	
	*/
	
	if (g_inforndr == null) g_inforndr = new HTMLRenderer();
	
	g_inforndr.setTemplate(tmpl);
	// add formatter functions for specific data value
	g_inforndr.addFormatter("txes", 'fmtTrans');
	g_inforndr.addFormatter("amount", 'fmtNemValue');
	g_inforndr.addFormatter("fee", 'fmtNemValue');
	g_inforndr.addFormatter("timestamp", 'fmtDateTime');

	var html = g_inforndr.render(data);
	
	$("body").addClass("overlay");
	$("#info_box span").html(html);
	$("#txes").html("");
	$("#overlay").show();
	
	if (obj_type != 'block')  return;

	tmpl = tbl.find("tbody tr td").html();
	g_inforndr.setTemplate(tmpl);
	
	var txlist = data['txes'];
	var n = txlist.length;
	
	html = "";
	for(var i = 0;i < n;i++) {
		html += g_inforndr.render(txlist[i]);
	}
	
	$("#txes").html(html);
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
