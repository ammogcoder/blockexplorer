'''
Distributed under the MIT License, see accompanying file LICENSE.txt
'''

import tornado.web
import tornado.httpserver 
import tornado.ioloop 
import tornado.options
import tornado.locale 
import os.path

from ConfigParser import SafeConfigParser
from tornado.options import define, options

#api
from handlers.ApiHandler import BlockAfterHandler
from handlers.ApiHandler import LastBlockHandler
from handlers.ApiHandler import AccountHandler
from handlers.ApiHandler import TransfersHandler
from handlers.ApiHandler import FromToBlocksHandler
from handlers.ApiHandler import SearchBlockByHashHandler
from handlers.ApiHandler import SearchTxByHashHandler
from handlers.ApiHandler import SearchHandler
from handlers.ApiHandler import FromToTxHandler
from handlers.ApiHandler import BlockChartHandler
from handlers.ApiHandler import HarvesterStatsHandler

#sockets
from handlers.SocketHandler import LatestBlockSocket
from handlers.SocketHandler import LatestTxSocket

parser = SafeConfigParser()
parser.read("settings.INI")

define("port", default=parser.get("blockexplorer", "port"), help="run on the given port", type=int)

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
        [
        #main page stuff
        #(r'/', FromToBlocksHandlerTemp),
        #(r'/blocks', FromToBlocksHandlerTemp),
                 
         #apis
         #blocks
         (r'/api/block-after', BlockAfterHandler),
         (r'/api/last-block', LastBlockHandler),
         (r'/api/blocks', FromToBlocksHandler),
         #account
         (r'/api/account', AccountHandler), 
         (r'/api/transfers', TransfersHandler),
         #txs
         (r'/api/txs', FromToTxHandler),
         #search
         (r'/api/tx', SearchTxByHashHandler),
         (r'/api/block', SearchBlockByHashHandler),
         (r'/api/search', SearchHandler),
         #stats
         (r'/api/stats/blocktimes', BlockChartHandler),
         (r'/api/stats/harvesters', HarvesterStatsHandler),
         
         #sockets
         #blocks
         (r'/socket/last-block', LatestBlockSocket),
         #txs
         (r'/socket/last-tx', LatestTxSocket),
         
         
        ], 
        **settings
    )
    
    #load translations
    translationsPath = os.path.join(os.path.dirname(__file__), "locale")
    tornado.locale.load_translations(translationsPath)    
    
    server = tornado.httpserver.HTTPServer(app, xheaders=True) 
    server.bind(options.port, '127.0.0.1')
    server.start()
    
    tornado.ioloop.IOLoop.instance().start()