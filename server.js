var fs = require('fs');
var url = require('url');
var http = require('http');
var qs = require('querystring');

var PORT = 3000;

function arraify(arr, o) {
	if(Array.isArray(arr)) {
		arr.push(o);
	} else {
		arr = [arr, o];
	}
	return arr;
}

function isImage(mime) {
	return mime.indexOf('image/') === 0;
}

function startServer(raw) {
	var routes = {};
	// 过滤出需要的数据
	var entries = raw.log.entries.map(function(entry){
		var parts = url.parse(entry.request.url), params;
		params = entry.request.queryString.filter(function(c){
			return c.name !== "_dc";
		});
		return {
			url: parts.pathname,
			code: entry.response.status,
			paramstr: qs.stringify(params),
			method: entry.request.method,
			response: entry.response.content.text,
			contentType: entry.response.content.mimeType
		};
	});
	// list 转成 map，加快查找速度
	entries.forEach(function(c){
		var json;
		if(c.contentType.indexOf('json') > -1) {
			json = JSON.parse(c.response);
			if(json.status === 'failure') {
				return ;
			}
		}
		if(!(c.method in routes)) {
			routes[c.method] = {};
		}
		if(c.url in routes[c.method]) {
			routes[c.method][c.url].push(c);
		} else {
			routes[c.method][c.url] = [c];
		}
	});
	var server = http.createServer(function(req, resp){
		var method = req.method;
		var parts = url.parse(req.url, true);
		var objects = routes[method][parts.pathname];
		// 如果不存在这样的 router ，直接返回
		if(!objects) {
			resp.writeHead(404);
			return resp.end();
		}
		var query = parts.query;
		var hit = false;
		if(query._dc) {
			delete query._dc;
		}
		// 根据 query 参数找到最合适的 router
		query = qs.stringify(query);
		objects.forEach(function(obj){
			if(obj.paramstr === query) {
				hit = obj;
				return false;
			}
		});
		if(!hit) {
			hit = objects[0];
		}
		resp.writeHead(hit.code, {'Content-Type': hit.contentType});
		// har 保存的图片是 base64 格式，所以转换一下
		if(isImage(hit.contentType)) {
			resp.end(new Buffer(hit.response, 'base64'));
		} else {
			resp.end(hit.response);
		}
	});
	server.listen(PORT);
	console.log("server started at: http://127.0.0.1:" + PORT);
}
function main() {
	var har = process.argv[2];
	if(!har) {
		console.error("please give me a .har file");
		return;
	}
	var data = fs.readFileSync(har, 'utf-8');
	startServer(JSON.parse(data));
}

if (module === require.main) {
	main()
}