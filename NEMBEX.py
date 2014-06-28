'''
Distributed under the MIT License, see accompanying file LICENSE.txt
'''

import tornado.web
import tornado.httpserver 
import tornado.ioloop 
import tornado.options
import tornado.locale 
import os.path

from tornado.options import define, options


from handlers.NembexHandler import NembexHandler
from handlers.ApiHandler import FromToBlocksHandlerTemp

#apis
from handlers.ApiHandler import AllBlocksHandler
from handlers.ApiHandler import BlockAfterHandler
from handlers.ApiHandler import LastBlockHandler
from handlers.ApiHandler import AccountHandler
from handlers.ApiHandler import TransfersHandler
from handlers.ApiHandler import FromToBlocksHandler

#sockets
from handlers.SocketHandler import LatestBlockSocket

#periodical
from periodics import RedisConnector

define("port", default=8000, help="run on the given port", type=int)

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
         (r'/', NembexHandler),
         (r'/blocks', FromToBlocksHandlerTemp),
                 
         #apis
         (r'/api/block-after', BlockAfterHandler),
         (r'/api/last-block', LastBlockHandler),
         (r'/api/account', AccountHandler), 
         (r'/api/transfers', TransfersHandler),
         (r'/api/recentblocks', AllBlocksHandler),
         (r'/api/blocks', FromToBlocksHandler),
         
         #sockets
         (r'/socket/last-block', LatestBlockSocket),
         
         
        ], 
        **settings
    )
    
    #load translations
    translationsPath = os.path.join(os.path.dirname(__file__), "locale")
    tornado.locale.load_translations(translationsPath)    
    
    server = tornado.httpserver.HTTPServer(app, xheaders=True) 
    server.listen(options.port) 
    
    #shedule periodics
    #RedisConnector.RedisConnector.redis_client.flushdb()
    #redisupdater = tornado.ioloop.PeriodicCallback(RedisConnector.RedisConnector.update_redischain, 15000)
    #redisupdater.start()
    
    tornado.ioloop.IOLoop.instance().start()