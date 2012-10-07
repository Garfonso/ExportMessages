/*global IMPORTS, libraries, Mojo, MojoLoader, log, logToApp */

try {
  console.error("Starting to load libraries");
  var Foundations = IMPORTS.foundations;
  var Future = Foundations.Control.Future; // Futures library
	var DB = Foundations.Data.DB;  // db8 wrapper library
  var fs = IMPORTS.require('fs');

	console.error("--------->Loaded Libraries OK");
} catch (Error) {
  console.error("Error during loading libraries: " + Error);
}

var locked = false;
var previousOperationFuture = new Future();
var logSubscription;
var stream;

//params: outerFuture, result, accountId, name
var finishAssistant_global = function(p) {
  var i;
  //log ("Finish Assistant called with " + p.name + ", " + p.accountId + ", " + JSON.stringify(p.result));
  previousOperationFuture.result = {go: true};
  locked = false;
  p.outerFuture.result = p.result;
};

//params: name, outerFuture, accountId
var startAssistant = function(params) {
  if (locked === true) {
    log("Already doing operation, waiting until it's finished.");
    previousOperationFuture.then(this, function (f) {
      log("PreviousOperation finished " + JSON.stringify(f.result) + " , starting " + params.name);
      params.run(params.outerFuture);
    });
    return false;
  }
  else {
    locked = true;
  }
  return true;
};

var log = function (logmsg) {
	console.error(logmsg);
	try {
	  if (typeof stream === "undefined") {
	    stream = fs.createWriteStream("/media/internal/.info.mobo.exportmessages.log", {flags:"w"});
	  }
	  stream.write(new Date() + ": " + logmsg + "\n");
	  //stream.end();
	} catch(e) {
	  console.error("Unable to write to file: " + e);
	}
};

var logToApp = function (logmsg) {
  log("==============================================");
  log("To App: " + logmsg);
  log("==============================================");
  if (!logSubscription || !logmsg) {
    log("Could not log to app: " + logSubscription + " and " + logmsg);
    return;
  }
  var f = logSubscription.get();
  f.result = { msg: logmsg };
};

var fresult = {};
var initialize = function(params) {
  var future = new Future(), innerFuture = new Future(fresult), initFinishCheck, initAccounts, future_, res;
  log("initialize helper, status: " + JSON.stringify(fresult));
    
  //checks if all inner init functions are finished. Only then it will set a result for the outer future.
  initFinishCheck = function (f) {
    if (f.result) {
      fresult = f.result;
      if (((params.something && f.result.something) || !params.something) && 
          ((params.something2 && f.result.something2) || !params.something2)) {
        //finished. :)
        log ("Init of all parts finished.");
        future.result = { returnValue: true};
      } else {
        log("Init not finished yet " + JSON.stringify(f.result));
        f.then(this, initFinishCheck);
        
        //here we can trigger "second step" initializations.
      }
    }
  };
  
//  if (params.something && !fresult.something) {
//    Something.initialize(innerFuture); //this should set innerFuture.result.something = true.
//  }
  
  innerFuture.then(this, initFinishCheck);
  return future;
};
