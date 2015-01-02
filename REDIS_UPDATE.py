'''
Distributed under the MIT License, see accompanying file LICENSE.txt
'''

import tornado.web
import tornado.httpserver 
import tornado.ioloop 
import tornado.options
import tornado.locale 
import os.path
import datetime
from ConfigParser import SafeConfigParser
from tornado.options import define, options

#periodical
from periodics import RedisConnector
from periodics import NetworkDiscoverer

parser = SafeConfigParser()
parser.read("settings.INI")

define("port", default=parser.get("redis", "updater_port"), help="run on the given port", type=int)

if __name__ == '__main__': 

    tornado.options.parse_command_line()

    settings = {
        "template_path": os.path.join(os.path.dirname(__file__), "templates"), 
        "static_path" : os.path.join(os.path.dirname(__file__), 'static'),
        "cookie_secret": "doEx8QhSQv+CUoZjKDevtL/5VODeEkUFgbWyv7PO0O4", #define your own here !
        "xsrf_cookies": True,
        "debug": False,
        "gzip":True,
        'pycket': {
            'engine': 'redis',
            'storage': {
                'host': 'localhost',
                'port': 6379,
                'db_sessions': 10,
                'db_notifications': 11,
                'max_connections': 2 ** 31,
            },
        },
    }

    #define the url endpoints
    app = tornado.web.Application(
        [], 
        **settings
    )
    
    server = tornado.httpserver.HTTPServer(app, xheaders=True) 
    server.listen(options.port, '127.0.0.1') 
    
    #shedule periodics
    redisupdater = tornado.ioloop.PeriodicCallback(RedisConnector.RedisConnector().run, int(parser.get("redis", "redis_update_interval")))
    redisupdater.start()
    redisupdater = tornado.ioloop.PeriodicCallback(NetworkDiscoverer.NetworkDiscoverer().run, int(parser.get("networkdiscoverer", "network_update_interval")))
    redisupdater.start()
    
    Worker = tornado.ioloop.IOLoop.instance()
    
    #run periodics with bigger gaps once
    Worker.add_timeout(datetime.timedelta(seconds=1), NetworkDiscoverer.NetworkDiscoverer().run)
    
    Worker.start()