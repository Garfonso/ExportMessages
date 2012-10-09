/*global Future, log, finishAssistant_global, logSubscription, startAssistant, logToApp, PalmCall, DB, fs */

var doExportAssitant = function (future) {
};

doExportAssitant.prototype.createHeadingLine = function () {
  var line = "Timestamp\tDateTime\tServiceName\tFoldername\tSender\tRecipients\tMessage\r\n";
  return line;
};

doExportAssitant.prototype.convertEntryToLine = function (e) {
  var line = "", i, text;
  line += (e.timestamp || " ") + "\t";
  line += (new Date(e.timestamp * 1000) || " ") + "\t";
  line += (e.serviceName || " ") + "\t";
  line += (e.folder || " ") + "\t";
  if (e.folder === "inbox") {
    line += (e.from.addr || "-") + "\t";
    line += "self\t";
  } else if (e.folder === "outbox"){
    line += "self\t";
    for (i = 0; i < e.to.length; i += 1) {
      line += e.to[i].addr + "";
      if (i !== e.to.length -1) {
        line += ", ";
      }
    }
    line += "\t";
  } else {
    log("Unknown folder " + e.folder);
    line += "unknown\tunknown\t";
  }
  if (e.messageText) {
    text = e.messageText.replace(/(\s)/gi," ");
  } else {
    text = "No text";
  }
  line += text + "\r\n";
  return line;
};

doExportAssitant.prototype.run = function (outerFuture, subscription) {
  log("============== doExportAssitant");
  var initializeCallback, databaseCallback, finishAssistant, args = this.controller.args, stats = { messages: 0, written: 0, count: 0, fileSize: 0 }, 
      config = args, fileStream, query = {};
  log("args: " + JSON.stringify(args));
  finishAssistant = function (result) {
    finishAssistant_global({outerFuture: outerFuture, result: result});
    logSubscription = undefined; //delete subscription.
  };
  log("Future: " + JSON.stringify(outerFuture.result));

  if (!startAssistant({outerFuture: outerFuture, run: this.run.bind(this) })) {
    delete outerFuture.result;
    if (subscription) {
      logSubscription = subscription; //cool, seems to work. :)
      logToApp("Export already running, connecting output to app.");
    }
    return;
  }

  databaseCallback = function (future) {
    try {
      var r = future.result, i, line, fileStats;
      if (r.returnValue === true) {
        for (i = 0; i < r.results.length; i += 1) {
          line = this.convertEntryToLine(r.results[i]);
          stats.messages += 1;
          fileStream.write(line);
        }
        //only the first count tells me how many messages there are... 
        if (!stats.count) {
          stats.count = r.count;
        }
        logToApp("Exported\t" + stats.messages + " / " + stats.count);

        //if there are more, call find again.
        if (stats.messages !== r.count && r.results.length && r.next) {
          query.page = r.next;
          DB.find(query, false, true).then(this, databaseCallback);
        } else {
          //we are finished. give back control to app.
          fileStream.end();
          fileStats = fs.statSync("/media/internal/" + config.filename);
          stats.fileSize = fileStats.size;
          log("Success, returning to client");
          finishAssistant({ finalResult: true, success: true, reason: "All went well", stats: stats});
        }
      } else {
        log("Got database error:" + JSON.stringify(r));
        finishAssistant({ finalResult: true, success: false, reason: "Database Failure: " + r.errorCode + " = " + r.errorText});
      }
    } catch (e) {
      log("Got database error:" + JSON.stringify(e));
      finishAssistant({ finalResult: true, success: false, reason: "Database Failure: " + (e ? e.name : "undefined") + " = " + (e ? e.message : "undefined")});
    }
  };
  
  logSubscription = subscription;
  if (!config.filename) {
    config.filename = "messages.txt";
  }
  fileStream = fs.createWriteStream("/media/internal/" + config.filename, {flags:"w"});
  fileStream.write(this.createHeadingLine());
  if (config.onlySMS) {
    query.from = "com.palm.smsmessage:1";
  } else {
    query.from = "com.palm.message:1";
  }
  query.limit = 100;
  log("Calling DB.find for the first time.");
  DB.find(query, false, true).then(this, databaseCallback);
  
  return outerFuture;
};
