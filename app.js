var express = require('express');
var app = express();
var FileStore = require('./lib/file-store');
var fileStore = new FileStore('/tmp/fakes3_root');
var xmlTemplateBuilder = require('./lib/xml-template-builder');
var morgan = require('morgan');
app.use(morgan('combined'));


app.get('/', function (req, res) {
  var buckets = fileStore.getAllBuckets();
  var xml = xmlTemplateBuilder.buildBucketsXml(buckets);
  res.header('Content-Type', 'application/xml');
  return res.send(xml);
});

app.get('/:bucket', function (req, res) {
  var acl = req.query.acl;
  var bucketName = req.params.bucket;
  if (acl) {
    return res.send('Getting acl');
  } else {
    fileStore.getBucket(bucketName, function (err, bucket) {
      if (err) {
        var template = xmlTemplateBuilder.buildBucketNotFoundXml(bucketName);
        res.header('Content-Type', 'application/xml');
        res.status(404);
        return res.send(template);
      }
      var options = {
        marker: req.query.marker || '',
        prefix: req.query.prefix || '',
        maxKeys: req.query['max-keys'] || 1000,
        delimiter: req.query.delimiter || null
      };
      fileStore.getAllKeysForBucket(bucket, options, function (err, keys) {
        res.header('Content-Type', 'application/xml');
        var template = xmlTemplateBuilder.buildBucketQueryXml(options, keys);
        return res.status(200).send(template);
      });
    });
  }
});
app.delete('/:bucket', function (req, res) {
  var bucketName = req.params.bucket;
  fileStore.getBucket(bucketName, function (err, bucket) {
    res.header('Content-Type', 'application/xml');
    if (err) {
      var template = xmlTemplateBuilder.buildBucketNotFoundXml(bucketName);
      res.header('Content-Type', 'application/xml');
      res.status(404);
      return res.send(template);
    }
    fileStore.deleteBucket(bucket, function (err) {
      if (err) {
        var template = xmlTemplateBuilder.buildBucketNotEmptyXml(bucketName);
        return res.status(409).send(template);
      }
      return res.status(204).end();
    });
  });
});

app.put('/:bucket', function (req, res) {
  var bucketName = req.params.bucket;
  res.header('Content-Type', 'application/xml');
  fileStore.getBucket(bucketName, function (err, bucket) {
    if (bucket) {
      var template = xmlTemplateBuilder.buildBucketNotFoundXml(bucketName);
      return res.send(template);
    }
    fileStore.createBucket(bucketName, function (err, bucket) {
      if (err) {
        return res.status(400).json('Error creating bucket');
      }
      return res.send(bucket);
    });
  });
});

var multipart = require('connect-multiparty');
var multipartMiddleware = multipart();
app.put('/:bucket/:key(*)', multipartMiddleware, function (req, res) {
  var bucketName = req.params.bucket;
  res.header('Content-Type', 'text/xml');
  fileStore.getBucket(bucketName, function (err, bucket) {
    //TODO create bucket if it does not exist
    fileStore.storeKey(bucket, req, function (err, key) {
      if (err) {
        return res.status(400).json('Error uploading file');
      }
      res.header('ETag', key.md5);
      return res.status(400).end();
    });
  });
});

app.get('/:bucket/:key(*)', function (req, res) {
  var bucketName = req.params.bucket;
  var keyName = req.params.key;
  fileStore.getBucket(bucketName, function (err, bucket) {
    if (err) {
      var template = xmlTemplateBuilder.buildBucketNotFoundXml(bucketName);
      res.header('Content-Type', 'application/xml');
      res.status(404);
      return res.send(template);
    }
    fileStore.getKey(bucket, keyName, function (err, key, data) {
      if (err) {
        var template = xmlTemplateBuilder.buildKeyNotFoundXml(keyName);
        res.header('Content-Type', 'application/xml');
        res.status(404);
        return res.send(template);
      }
      res.header('Etag', key.md5);
      res.header('Content-Type', key.contentType);
      return res.status(200).end(data);
    });
  });
});

var server = app.listen(3000, function () {
  var host = server.address().address;
  var port = server.address().port;
  console.log('Example app listening at http://%s:%s', host, port);
});