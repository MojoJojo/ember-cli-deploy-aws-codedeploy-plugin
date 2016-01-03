/* jshint node: true */
'use strict';
var DeployPluginBase = require('ember-cli-deploy-plugin');
var util = require('util');
var path = require('path');
var S3Client = require('./lib/aws-s3');
var CodeDeployClient = require('./lib/aws-codedeploy');
var minmatch = require('minimatch');


module.exports = {
    name: 'ember-cli-deploy-aws-codedeploy',
    createDeployPlugin: function(options) {
        var DeployPlugin = DeployPluginBase.extend({
            name: options.name,
            defaultConfig: {
                filePattern: '**/*.{js,css,png,gif,ico,jpg,map,xml,txt,svg,swf,eot,ttf,woff,woff2,yml,html,htm}',
                basePackageName: this.project.pkg.name + '-' + this.project.pkg.version,
                keep: false,
                archiveType: 'gzip',
                archiveTempDirectory: 'tmp',
                uploadToS3: true,

                distDir: function(context) {
                    return context.distDir;
                },
                distFiles: function(context) {
                    return context.distFiles || [];
                },

                manifestPath: function(context) {
                    return context.manifestPath; // e.g. from ember-cli-deploy-manifest
                },
                revisionKey: function(context) {
                    var revisionData = context.revisionData;

                    return revisionData.revisionKey + '-' + revisionData.timestamp;
                },
            },
            ensureConfigPropertySet: function(propertyName) {

                if (!this.propertyByString(this.pluginConfig,propertyName)) {
                    var message = 'Missing required config: `' + propertyName + '`';
                    this.log(message, {
                        color: 'red'
                    });
                    throw new Error(message);
                }
            },
            requiredConfig: ['accessKeyId', 'secretAccessKey', 'region', 'deploymentOptions.applicationName', 'deploymentOptions.deploymentGroupName', 'deploymentOptions.S3Bucket'],
            prepare: function(context) {
                /** Initialize configuration for both S3 and CodeDeploy client **/
                /** First, S3 Service options **/

                this.awsS3ServiceOptions = this.readConfig('awsServiceOptions');
                if (!this.awsS3ServiceOptions['accessKeyId'])
                    this.awsS3ServiceOptions['accessKeyId'] = this.readConfig('accessKeyId');
                if (!this.awsS3ServiceOptions['secretAccessKey'])
                    this.awsS3ServiceOptions['secretAccessKey'] = this.readConfig('secretAccessKey');
                if (!this.awsS3ServiceOptions['region'])
                    this.awsS3ServiceOptions['region'] = this.readConfig('region');

                this.awsCodeDeployServiceOptions = this.readConfig('awsServiceOptions');
                if (!this.awsCodeDeployServiceOptions['accessKeyId'])
                    this.awsCodeDeployServiceOptions['accessKeyId'] = this.readConfig('accessKeyId');
                if (!this.awsCodeDeployServiceOptions['secretAccessKey'])
                    this.awsCodeDeployServiceOptions['secretAccessKey'] = this.readConfig('secretAccessKey');
                if (!this.awsCodeDeployServiceOptions['region'])
                    this.awsCodeDeployServiceOptions['region'] = this.readConfig('region');





                this._awsS3Client = new S3Client({
                    log: this.log,
                    awsS3ServiceOptions: this.awsS3ServiceOptions,
                    distDir: this.readConfig('distDir'),
                    filePattern: this.readConfig('filePattern'),
                    s3FolderPrefix: this.readConfig('prefix'),
                    revisionKey: this.readConfig('revisionKey'),
                    bucket: this.readConfig('S3Bucket'),
                    acl: this.readConfig('acl'),
                    manifestPath: this.readConfig('manifestPath'),
                    archiveType: this.readConfig('archiveType'),
                    archiveTempDirectory: this.readConfig('archiveTempDirectory'),
                    prefix: this.readConfig('prefix')
                }, this);
                this._awsCodeDeployClient = new CodeDeployClient({
                    log: this.log,
                    awsCodeDeployServiceOptions: this.awsCodeDeployServiceOptions,
                    awsDeploymentOptions: this.readConfig('deploymentOptions'),

                });
            },
            upload: function(context) {
                this.log('AWS Code deploy plugin invoked');
                var distributionFiles = this.readConfig('distFiles');
                var filePattern = this.readConfig('filePattern');


                return this._awsS3Client.upload(distributionFiles.filter(minmatch.filter(filePattern, {
                    matchBase: true
                }))).then(function(fileUploaded) {
                    this.log('AWS CodeDeploy: Finished uploading ' + this.readConfig('revisionKey') + '.' + this.readConfig('archiveType') + ' to S3 bucket ' + this.readConfig('S3Bucket'));
                    return this._awsCodeDeployClient.createDeployment(
                        this.readConfig('S3Bucket'),
                        this.readConfig('archiveType'),
                        fileUploaded.eTag.ETag,
                        fileUploaded.key,

                        '');



                }.bind(this)).catch(this._errorMessage.bind(this));





                // First verify deployment group name
                // Then verify application name exists in the group
                // Then create an archive file containing appspec.yml
                //Then create a revision
                //Finally create a deployment
                //
                //
            },
            didUpload: function(context) {

            },
            
            propertyByString: function(object, property) {

                var properties = property.replace(/\[(\w+)\]/g, '.$1'); // convert indexes to properties
                properties = properties.replace(/^\./, ''); // strip a leading dot
                var a = properties.split('.');
                for (var i = 0, n = a.length; i < n; ++i) {
                    var k = a[i];
                    if (k in object) {
                        object = object[k];
                    } else {
                        return;
                    }
                }
                return object;


            },
            _errorMessage: function(error) {
                this.log(error, {
                    color: 'red'
                });
                if (error) {
                    this.log(error.stack, {
                        color: 'red'
                    });
                }
                return Promise.reject(error);
            },
        });
        return new DeployPlugin();
    }
};
