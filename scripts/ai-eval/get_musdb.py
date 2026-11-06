import sys, musdb
db = musdb.DB(root=sys.argv[1], download=True)
print(len(db.tracks), "morceaux")
