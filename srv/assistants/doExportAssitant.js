/*jslint white: true */
/*global Future, log, finishAssistant_global, logSubscription, startAssistant, logToApp, PalmCall, DB, fs */

var doExportAssitant = function (future) { "use strict"; };

doExportAssitant.prototype.createHeadingLine = function () {
  "use strict";
  var line = "Timestamp\tDateTime\tServiceName\tFoldername\tSender\tRecipients\tMessage\r\n";
  return line;
};

doExportAssitant.prototype.createHeadingLineXML = function () {
  "use strict";
  var line = '<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>\n<?xml-stylesheet type="text/xsl" href="sms.xsl"?>\n<smses>\n';
  return line;
};

doExportAssitant.prototype.convertEntryToLine = function (e) {
  "use strict";
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
      line += String(e.to[i].addr);
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

doExportAssitant.prototype.convertEntryToLineXML = function (e, index) {
  "use strict";

  var line, other;
  if (!index) {
    index = 0;
  }

  if (e.from && e.from.addr) {
    other = {
      addr: e.from.addr,
      name: "(Unknown)"
    };
  } else if (e.to && e.to[index]) {
    other = {
      addr: e.to[index].addr,
      name: e.to[index].name || "(Unknown)"
    };
  } else {
    if (index === 0) {
      console.error("Message had no to or from field!");
      console.error(JSON.stringify(e));

      if (e.folder !== "inbox" && e.folder !== "outbox") {
        console.error("Unknown folder: " + e.folder);
      }

      other = {
        addr: "UNKNOWN",
        name: "(Unknown)"
      };
    } else {
      return "";
    }
  }

  if (!e.messageText) {
    e.messageText = "";
  }

  line = "<sms protocol=";
  line += e.serviceName !== "sms" ? "1" : "0";
  line += " address=" + other.addr;
  line += '" date="' + e.localTimestamp;
  line += '" type="' + (e.folder === "inbox" ? "1" : "2");
  line += '" subject="null" body="' + e.messageText + '" toa="null" sc_toa="null" service_center="null" read="1" status="-1" ';
  line += 'readable_date="' + new Date(e.localTimestamp) + '" ';
  line += 'contact_name="' + other.name + '" />\n';

  if (e.folder === "inbox") {
    return line;
  } else {
    return line + this.convertEntryToLineXML(e, index + 1);
  }
};

doExportAssitant.prototype.run = function (outerFuture, subscription) {
  "use strict";
  log("============== doExportAssitant");
  var databaseCallback, finishAssistant, args = this.controller.args, stats = { messages: 0, written: 0, count: 0, fileSize: 0 },
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
          if (config.xml) {
            line = this.convertEntryToLineXML(r.results[i]);
          } else {
            line = this.convertEntryToLine(r.results[i]);
          }
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
          if (config.xml) {
            fileStream.write("</smses>");
          }
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
  if (config.xml) {
    fileStream.write(this.createHeadingLineXML());
  } else {
    fileStream.write(this.createHeadingLine());
  }
  if (config.onlySMS) {
    query.from = "com.palm.smsmessage:1";
  } else {
    query.from = "com.palm.message:1";
  }

  query.limit = 100;
  query.incDel = false;
  log("Calling DB.find for the first time.");
  DB.find(query, false, true).then(this, databaseCallback);

  return outerFuture;
};
