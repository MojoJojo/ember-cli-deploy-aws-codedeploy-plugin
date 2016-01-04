var CoreObject = require('core-object');
var util = require('util');
module.exports = CoreObject.extend({
    init: function(options) {
        var AWS = require('aws-sdk');
        this.codeDeploy = new AWS.CodeDeploy(this.awsCodeDeployServiceOptions);
    },
    createDeployment: function(awsDeploymentOptions) {
        return new Promise(function(resolve, reject) {
            
            this.codeDeploy.createDeployment(awsDeploymentOptions, function(error, data) {
                if (error)
                    reject(error); // an error occurred
                else resolve(data.deploymentId); // successful response. Return deployment Id
            }.bind(this));
        }.bind(this));
    }
});
