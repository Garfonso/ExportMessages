//JSLint options:
/*global log, logGUI, logStatus, $L, Mojo, AppAssistant, PalmCall, config */
function WelcomeAssistant() {
	/* this is the creator function for your scene assistant object. It will be passed all the 
	   additional parameters (after the scene name) that were passed to pushScene. The reference
	   to the scene controller (this.controller) has not be established yet, so any initialization
	   that needs the scene controller should be done in the setup function below. */
}

WelcomeAssistant.prototype.setup = function () {
  config.disabled = false;
  config.label = $L("Do Export");
  
  this.oldLog = log;
	log = logGUI.bind(this, this.controller);
	this.oldStatus = logStatus;
	logStatus = logStatus.bind(this, this.controller);


  this.controller.setupWidget(Mojo.Menu.appMenu, {}, AppAssistant.prototype.MenuModel);
  
  this.controller.setupWidget("ckOnlySMS", { modelProperty: "onlySMS" }, config);
  this.controller.setupWidget("txtFilename", { modelProperty: "filename", hintText: $L("Filename of the export"), textCase: Mojo.Widget.steModeLowerCase}, config);
  this.controller.setupWidget("btnStartExport", { type : Mojo.Widget.activityButton }, config );

 
	/* add event handlers to listen to events from widgets */
	Mojo.Event.listen(this.controller.get("btnStartExport"), Mojo.Event.tap, this.startExport.bind(this));
};

WelcomeAssistant.prototype.startExport = function (event) {
  if (this.locked) {
    log("Export already running. Correct?");
    return;
  }
  this.controller.get("btnStartExport").mojo.activate();
  config.disabled = true;
  this.controller.modelChanged(config);
  
  var oldMsg = "", future, account, keepInTouch,
    getResult = function (f) {
    if (f.result.finalResult) {
      //log("FINAL RESULT!!");
      log(oldMsg);
      //export finished.
      if (f.result.success) {
        logStatus("Export returned ok");
        if (f.result.stats) {
          log("Exported " + f.result.stats.messages + " in file " + config.filename + " with size " + f.result.stats.fileSize);
        }
      } else {
        logStatus("Export returned with error.");
      }
      this.controller.get("btnStartExport").mojo.deactivate();
      config.disabled = false;
      this.controller.modelChanged(config);
      this.locked = false;
      log("Canceling futures: ");
      f.cancel();
      PalmCall.cancel(future);
      log("Ok.");
    } else {
      f.then(this, getResult);
    }
    
    if (f.result.msg) {
      log(oldMsg);
      oldMsg = f.result.msg;
      logStatus(f.result.msg);
    }

    if (f.result.reason) {
      log(f.result.reason);
      logStatus(f.result.reason);
    }
  };
      
  try {
    this.locked = true;
    config.subscribe = true;
    log("Calling service.");
    future = PalmCall.call("palm://info.mobo.exportmessages.service/", "doExport", config);
    future.then(this, getResult);
    keepInTouch = function () {
      if (this.locked) {
        future.then(this, getResult);
        setTimeout(keepInTouch.bind(this), 10);
      }
    };
    setTimeout(keepInTouch.bind(this), 10);
  } catch (e) { 
    log("Error: " + e.name + " what: " + e.message + " - " + e.stack); 
    this.locked = false; 
  }
};

WelcomeAssistant.prototype.activate = function (event) {
};

WelcomeAssistant.prototype.deactivate = function (event) {
	/* remove any event handlers you added in activate and do any other cleanup that should happen before
	   this scene is popped or another scene is pushed on top */
  log = this.oldLog;
	logStatus = this.oldStatus;
};

WelcomeAssistant.prototype.cleanup = function (event) {
	/* this function should do any cleanup needed before the scene is destroyed as 
	   a result of being popped off the scene stack */
};
