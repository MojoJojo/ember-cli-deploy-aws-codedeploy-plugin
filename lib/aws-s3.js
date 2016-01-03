var CoreObject = require('core-object');
var fs = require('fs');
var path = require('path');
var AWS = require('aws-sdk');
var archiver = require('archiver');
var Promise = require('ember-cli/lib/ext/promise');
var _ = require('lodash');
var util = require('util');
var mime = require('mime');
var EXPIRE_IN_2030 = new Date('2030');
var TWO_YEAR_CACHE_PERIOD_IN_SEC = 60 * 60 * 24 * 365 * 2;
module.exports = CoreObject.extend({
    init: function(pluginOptions, parentPlugin) {
        this.parentPlugin = parentPlugin;
        this.awsS3Client = new AWS.S3(pluginOptions.awsS3ServiceOptions);
    },
    upload: function(distFiles) {
        var parentPlugin = this.parentPlugin;
        return this.getFilesForUpload(distFiles)
            .then(this.createArchiveForFiles.bind(this))
            .then(this.uploadArchive.bind(this))
    },
    getFilesForUpload: function(distFiles) {
        var pluginOptions = this.pluginOptions;
        var filePaths = distFiles || [];
        if (typeof filePaths === 'string') {
            filePaths = [filePaths];
        }
        var prefix = this.s3FolderPrefix;
        var manifestPath = this.manifestPath;
        if (manifestPath) {
            var key = prefix === '' ? manifestPath : [prefix, manifestPath].join('/');
            plugin.log('Downloading manifest for differential deploy from `' + key + '`...', {
                verbose: true
            });
            return new Promise(function(resolve, reject) {
                var params = {
                    Bucket: pluginOptions.bucket,
                    Key: key
                };
                this.awsS3Client.getObject(params, function(error, data) {
                    if (error) {
                        reject(error);
                    } else {
                        resolve(data.Body.toString().split('\n'));
                    }
                }.bind(this));
            }.bind(this)).then(function(manifestEntries) {
                plugin.log("Manifest found. Differential deploy will be applied.", {
                    verbose: true
                });
                return this.difference(filePaths, manifestEntries);
            }).catch(function( /*reason*/ ) {
                plugin.log("Manifest not found. Disabling differential deploy.", {
                    color: 'yellow',
                    verbose: true
                });
                return Promise.resolve(filePaths);
            });
        } else {
            return Promise.resolve(filePaths);
        }
    },
    createArchiveForFiles: function(filePaths) {
        var archive = archiver.create(this.archiveType);
        var archiveFilePath = path.join(this.archiveTempDirectory, this.revisionKey + '.' + this.archiveType);
        var outputFile = fs.createWriteStream(archiveFilePath);
        return new Promise(function(resolve, reject) {
            outputFile.on('close', function() {
                resolve(archiveFilePath);
            });
            outputFile.on('error', function(error) {
                reject(error);
            });
            archive.pipe(outputFile);
            for (var filePath of filePaths) {
                archive.append(fs.createReadStream(path.join(this.distDir, filePath)), {
                    name: filePath
                })
            }
            archive.finalize();
        }.bind(this));
    },
    uploadArchive: function(codeDeployArchive) {
        var parentPlugin = this.parentPlugin;
        var data = fs.readFileSync(codeDeployArchive);
        var contentType = mime.lookup(codeDeployArchive);
        var encoding = mime.charsets.lookup(contentType);
        var cacheControl = 'max-age=' + TWO_YEAR_CACHE_PERIOD_IN_SEC + ', public';
        var expires = EXPIRE_IN_2030;
        if (encoding) {
            contentType += '; charset=';
            contentType += encoding.toLowerCase();
        }
        var putObjectOptions = {
            Bucket: this.bucket,
            ACL: this.acl,
            Body: data,
            ContentType: contentType,
            Key: codeDeployArchive,
            CacheControl: cacheControl,
            Expires: expires,
        };
        
        return new Promise(function(resolve, reject) {
        	console.log('S# Object');
        	console.log(this.awsS3Client);
            this.awsS3Client.putObject(putObjectOptions, function(error, data) {
                if (error) {
                    reject(error);
                } else {
                    resolve({eTag:data, key:code});
                }
            }.bind(this));
        }.bind(this));
    }
});