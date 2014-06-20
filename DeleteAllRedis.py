#!/usr/bin/env python
# -*- coding: utf-8 -*- 

# Run this script to take off and nuke the data store from orbit.
import redis

r        = redis.StrictRedis(host='localhost', port=6379, db=3)
rBids    = redis.StrictRedis(host='localhost', port=6379, db=4)
rAsks    = redis.StrictRedis(host='localhost', port=6379, db=5)
rUsers   = redis.StrictRedis(host='localhost', port=6379, db=6)

for k in r.keys():
	r.delete(k)

for k in rBids.keys():
	rBids.delete(k)

for k in rAsks.keys():
	rAsks.delete(k)

for k in rUsers.keys():
	rUsers.delete(k)
