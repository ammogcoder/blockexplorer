/*
@name		:	NEM Blockchain Explorer
@version	:	0.1.2 (alpha)
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
		/api/stats/blocktimes - will give the last 120 blocktimes
		/api/stats/v2/blocktimes - will give the 1st 120 blocktimes
			possible parameters
			height 	(startng height) 
			numBlocks (nubmer of blocks returned from starting height)

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
var g_avrg_range= null;		// average y-axis range [55,65] is prbable default range value

//var g_avrg 		= null; // just for testing purposes

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
	initInfoBox();
	initInfoLinks();
	initNavigation();
	initChartBlocksRangeSelect();
	
	initPage();
	
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
		if (acc === undefined) {
			var hash = $(evt.target).data('blockhash');
			showBlock(hash);

		} else {
			showAccount(acc);
		}
	});
}


function initSearch() {
	// search data validation pattern
	//var rex = new RegExp("^[a-zA-Z0-9]{10,}$","g");
	if (g_rex == null)
		g_rex = new RegExp("^[a-zA-Z0-9\\-]{15,}$","g");
	
	
	$(".srch input").keyup(function(evt) {
		
		if (evt.which != 13) return;
		
		var val = $.trim(this.value);
		g_rex.lastIndex = 0;
		if (! g_rex.test(val)) {
			showErr("Invalid search entry!");
			//alert(val);
			return;
		}
		
		val = val.replace(/\-/g,'');
		
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


function initChartBlocksRangeSelect() {
	
	$("#chart_info h2 input").change(function(evt) {
		evt.preventDefault();
		
		switch(this.id) {

		case 'calcRange':
			
			showChart();
			break;
		}
		
	});
		
	$("#chart_info h2 input").mousemove(
		function(evt) {
			var id = this.id;
			$("label[for='" + id + "']").html(this.value);
		}
	); 
	
	
	$("#chart_info h2 input").each(function(i) {
		var id = this.id;
		$("label[for='" + id + "']").html(this.value);
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
	
	
	if (arguments.length > 0) return;
	
	showChart();
}


function showChart() {
	
	$("#chart_info").show();
	
	if (g_chart == null) {
		$("#canvas").addClass("loading");
		$("#canvas").html("<h3>Loading</h3>");
	}
	
	var avg_blocks = $("#calcRange").val();
	var tot_blocks = 2000;
	
	//get last block height
	$.get("/api/last-block").done(function(res) {
			
		var block = JSON.parse(res);
		var last_block = block.height - tot_blocks;
		
		// load the block times stats
		var params = new Object();
		params['height'] = last_block;
		params['numBlock'] = tot_blocks;
		
		$.get("/api/stats/v2/blocktimes",params).done(function(res) {
			
			try {
				var json = JSON.parse(res);
				var data = json['blocktimes'];
				
				data = calcAvgBT(data,avg_blocks);
				renderChart(data);
	
			} catch(e) {
				showErr(e.message);
			}
			
		}).fail(function(xhr, ajaxOptions, thrownError) {
			alert(xhr.status);
			alert(thrownError);
		});
		
	}).fail(function(xhr, ajaxOptions, thrownError) {
		alert(xhr.status);
		alert(thrownError);
	});
	
}

/* to be used later maybe
function pts_info(e, x, pts, row) {
	
	var str = "(" + x + ") ";
	
	for (var i = 0; i < pts.length; i++) {
		var p = pts[i];
		if (i) str += ", ";
		str += p.name + ": " + p.yval;
	}

	return str;
}
*/



function getAvrgRange() {
	/*
	var val = $("#console").val();
	val += "\n" + g_avrg_range.toSource() + " # " + g_avrg.toSource();
	$("#console").val(val);
	*/
	return g_avrg_range; 	
}


/**
calculate the min and max for the averages y - axis
returns: array with [min,max] values
*/
function avrgMinMaxRange(data,minDate,maxDate) {
	
	minDate = Math.round(minDate);
	maxDate = Math.round(maxDate);
	
	var rangeData = data.filter(function(d) {
		return d[0] >= minDate && d[0] <= maxDate;
	});
	
	var min = d3.min(data,function(d) { return d[2]; });
	var max = d3.max(data,function(d) { return d[2]; });

	g_avrg = [min,max];
	
	min = Math.floor(min);
	max = Math.floor(max) + 5;
	
	min -= min % 5;
	max -= max % 5;
	
	return [min,max];	
}


function renderChart(data) {

	var nblocks = data.length;

	var range = Array();
	range.push(data[nblocks-1][0]);
	range.push(range[0]-60);
	range = range.reverse();
	
	if (g_chart != null) {
		
		var avrgRange = g_chart.xAxisRange();
		g_avrg_range = avrgMinMaxRange(data,avrgRange[0],avrgRange[1]);
		
		g_chart.updateOptions({
			'file': data,
			axes: {y2: {valueRange: getAvrgRange() }}
			//', dateWindow': range
		});
		return;
	}
	
	g_avrg_range = avrgMinMaxRange(data,range[0],range[1]);
	
	$("#canvas").removeClass("loading");
	$("#canvas").html("");
	
	g_chart = new Dygraph(
		document.getElementById("canvas"),
		data,
		{
			labels: [ 'Height', 'Time', 'Average'],
			labelsDiv: 'label_div',
			colors: ['#8e8e8e','#dfa82f'],
			axisLabelColor: '#ffffff',
			strokeWidth: 1.75,
			highlightCircleSize: 4,
			dateWindow: range,
			ylabel: 'Block time (seconds)',
			y2label: 'Average block time (seconds)',
            series: {
              'Average': {
                axis: 'y2',
                stepPlot: false,
              }
            },
            axes: {
            	y: {
            		// set axis-related properties here
            		drawGrid: false,
            		independentTicks: true
            	},
            	y2: {
            		// set axis-related properties here
        			valueRange: getAvrgRange(), //[55,65],            		
            		labelsKMB: false,
            		drawGrid: true,
            		independentTicks: true,
            		/*
            		ticker: function(min, max, pixels, opts, dygraph, vals) {
            			
            			var tickers = new Array();
            			min = Math.floor(min);
            			max = Math.ceil(max);
            			
            			if (min >= 55 && max <= 65) {
            				min = 55;
            				max = 65;
            			}
            			
            			document.title = min + " -> " + max; 

            			while(min < max) {
            				var oTicker = new Object();
            				oTicker['v'] = min;
            				oTicker['label'] = "" + min;
            				tickers.push(oTicker);
            				min += 0.25;
            			}

            			//var your_value = 7.5;
            			////Get auto-generated tickers (numericTicks is the default ticker generator)
            			//var tickers = Dygraph.numericTicks(min, max, pixels, opts, dygraph, vals);
            			//tickers.push({v: your_value, label: 'Custom Label'}); //Insert your label
            			
            			return tickers;
            		}
            		*/
            	}
            },
			legend: 'always',
			showRangeSelector: true,
			drawCallback: function(g) {
				
				/*
				disabled - it slow down the graph rendering
				var xRange = g.xAxisRange();
				xRange[0] = Math.round(xRange[0]);
				xRange[1] = Math.round(xRange[1]);
				
				g_avrg_range = avrgMinMaxRange(data,xRange[0],xRange[1]);
				*/
			},
			zoomCallback: function(minDate, maxDate, yRanges) {
				
				/*
				//disabled - it slow down the graph rendering and
				//	conflicts with the normal range selction functionality
				
				g_avrg_range = avrgMinMaxRange(data,minDate,maxDate);
				
				g_chart.updateOptions({
					axes: {y2: {valueRange: getAvrgRange() }}
				});
				*/
			}
		}
	);
	
}


/**
calculate the averages block times
returns: array containing array elemtns example: [height,time,average]
*/
function calcAvgBT(data) {
	
	data = d3.entries(data);
	
	// sort data based on block height
	data.sort(function(a,b) {
		var a = parseInt(a.key);
		var b = parseInt(b.key);
		
		return a > b ? 1 : -1;
	});
	
	// set the average blocks calcuclation value
	var avg_blocks = arguments.length == 2 && (! isNaN(arguments[1])) ? parseFloat(arguments[1]) : 60;
	var nblocks = data.length - 1;
	var limit = nblocks - (nblocks - avg_blocks) -1;
	var sum_elems = 0;
	var sum_stack = 1.0;
	
	var calc = new Array();
	
	for (var i = nblocks;i > limit;i--) {
				
		while (sum_elems < avg_blocks) {
			var indx = nblocks - sum_elems;
			sum_stack += data[indx].value;
			sum_elems += 1;
		}
		
		if (i < nblocks) {
			sum_stack -= data[i+1].value;
			sum_stack += data[(i+1) - avg_blocks].value;
		}
		
		//if (! data[i]) { alert(i); }
		
		var block = new Array(
			parseInt(data[i].key),
			data[i].value / 1000,
			(sum_stack / avg_blocks) / 1000
		);
		
		calc.unshift(block);
	}
	
	return calc;
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


function showBlock(blockhash) {
	
	var URL = "/api/block";
	var params = new Object();
	params["hash"] = blockhash;
	
	// /api/block?hash=

	$.ajax({
			async	:	true,
			method	:	"GET",
			data	: 	params,
			url		: 	URL
	}).done(function(res) {
		try {
			
			json = JSON.parse(res);
			showBlockInfo(json);
			
		} catch(e) {
			showErr("Results not found!");
		}
		
		
	}).fail(function(xhr, ajaxOptions, thrownError) {
		alert(xhr.status);
		alert(thrownError);
	}).always(function() {
		//g_running = false;
	});	
}


function showBlockInfo(data) {
	var tmpdata = data;
	
	tbl = $($("#info").html());
	tmpl = tbl.find("thead td").html();
	if (g_inforndr == null) g_inforndr = new HTMLRenderer();
	
	g_inforndr.setTemplate(tmpl);
	g_inforndr.addFormatter("txes", 'fmtTrans');
	g_inforndr.addFormatter("amount", 'fmtNemValue');
	g_inforndr.addFormatter("fee", 'fmtNemValue');
	g_inforndr.addFormatter("timestamp", 'fmtDateTime');
	g_inforndr.addFormatter("message", 'fmtMessage');

	var html = g_inforndr.render(data);

	// add formatter functions for specific data value
	g_inforndr.addFormatter("messages", 'fmtTrans');
	g_inforndr.addFormatter("balance", 'fmtNemValue');
	
	$("body").addClass("overlay");
	$("#info_box span").html(html);
	$("#txes").html("");
	$("#overlay").show();

	// transactions
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


function fmtMessage(key,data) {
	
	var msg = data[key];
	if (! msg) return msg;	

	msg = msg.match(/.{1,64}/g);
	msg = msg.join("\\\n");
	
	return msg;
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
	
	//alert(obj_type);
	
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
	g_inforndr.addFormatter("message", 'fmtMessage');

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
