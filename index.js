var request = require("request");
var fs = require("fs");
var Service, Characteristic;

module.exports = function(homebridge) {
	Service = homebridge.hap.Service;
	Characteristic = homebridge.hap.Characteristic;

	homebridge.registerAccessory("homebridge-httpdoor", "Httpdoor", DoorAccessory);
};

function DoorAccessory(log, config) {
	this.log = log;
	this.name = config["name"];
	this.deviceID = config["deviceID"];
	this.openState = config["openState"];
	this.closedState = config["closedState"];
	this.controlURL = config["controlURL"];
	this.statusURL = config["statusURL"];

	this.garageservice = new Service.GarageDoorOpener(this.name);

	this.garageservice
		.getCharacteristic(Characteristic.CurrentDoorState)
		.on('get', this.getState.bind(this));

	this.garageservice
		.getCharacteristic(Characteristic.TargetDoorState)
		.on('get', this.getState.bind(this))
		.on('set', this.setState.bind(this));
}

function parseStateResponse(body, deviceID)
{
	var doorState = null;
	var x = body.split('\n')[4];
	var statuses = x.substring(0, x.length - 9).split(",");
	var l = statuses.length;
	for (var i = 0; i < l; i++)
	{
		if (statuses[i].indexOf(deviceID) >= 0)
		{
			var state = statuses[i].split("|")[1];
			if (state == "0")
			{
				doorState = "closed";
			}
			else if (state == "1")
			{
				doorState = "open";
			} else {
				doorState = "moving";
			}
		}
	}
	return doorState;
}


function getTimeCode()
{
	var baseTime = new Date.UTC(2010, 1, 1, 0, 0, 0, DateTimeKind.Utc);
	var currentTime = new Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(),  now.getUTCHours(),
		now.getUTCMinutes(), now.getUTCSeconds());

    var timeDiff = Math.abs(currentTime - baseTime);
    console.log("timeDiff is %s", timeDiff);
    return timeDiff;

}

DoorAccessory.prototype.getState = function(callback) {
	this.log("Getting current state...");

	request.get({
		url: this.statusURL // need to add timeCode here...
	}, function(err, response, body) {
		if (!err && response.statusCode == 200) {
			var timeDiff = getTimeCode();
			console.log("timeDiff is currently %s", timeDiff);
			var pollState = parseStateResponse(body, this.deviceID);
			var closed = pollState == "closed";
			callback(null, closed); // success
		} else {
			this.log("Error getting state: %s", err);
			callback(err);
		}
	}.bind(this));
};

DoorAccessory.prototype.setState = function(state, callback) {
	var doorState = (state == Characteristic.TargetDoorState.CLOSED) ? "closed" : "open";
	this.log("Set state to %s", doorState);
	request.get({
		url: this.controlURL
	}, function(err, response, body) {
		if (!err && response.statusCode == 200) {
			this.log("State change complete.");
			var currentState = (state == Characteristic.TargetDoorState.CLOSED) ? Characteristic.CurrentDoorState.CLOSED : Characteristic.CurrentDoorState.OPEN;
			this.garageservice
			.setCharacteristic(Characteristic.CurrentDoorState, currentState);

			callback(null); // success
		} else {
			this.log("Error '%s' setting door state. Response: %s", err, body);
			callback(err || new Error("Error setting door state."));
		}
	}.bind(this));
};

DoorAccessory.prototype.getServices = function() {
	return [this.garageservice];
};