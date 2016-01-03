var CoreObject = require('core-object');
var util = require('util');
module.exports = CoreObject.extend({
    init: function(options) {
        var AWS = require('aws-sdk');
        console.log('initn called ');
        console.log(this.awsCodeDeployServiceOptions);
        this.codeDeploy = new AWS.CodeDeploy(this.awsCodeDeployServiceOptions);

    },
    listDeploymentGroups: function(options) {
        return new Promise(function(resolve, reject) {
            var params = {
                applicationName: 'STRING_VALUE',
                deploymentGroupName: 'STRING_VALUE'
            };
            this.codeDeploy.listDeploymentGroups(params, function(err, data) {
                if (err)
                    reject(err.stack);
                else resolve(data.applications);
            });
        });
    },
    listApplications: function(options, deploymentGroup) {
        return new Promise(function(resolve, reject) {
            var params = {
                nextToken: '',
            };
            this.codeDeploy.listApplications(params, function(err, data) {
                if (err)
                    reject(err.stack);
                else resolve(data.applications);
            });
        });
    },
    createDeployment: function(bucket, bundleType, eTag, key, version) {

        console.log('creating deployment with eTag: ' + eTag);
        console.log('creating deployment with key: ' + key);
        

        var params = this.awsDeploymentOptions;
        if (params.revision.revisionType === 'S3') {
            params.revision.s3Location = {
                bucket: bucket,
                bundleType: bundleType,
                eTag: eTag,
                key: key,
                version: undefined,



            };
            params.revision.gitHubLocation = undefined;
        }

        return new Promise(function(resolve, reject) {
            console.log(util.inspect(this.codeDeploy,4));
            this.codeDeploy.createDeployment(params, function(error, data) {
                if (error)
                    reject(error); // an error occurred
                else resolve(data); // successful response
            }.bind(this));

        }.bind(this));



    }
});
