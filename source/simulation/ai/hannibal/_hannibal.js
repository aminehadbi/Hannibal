/*jslint bitwise: true, browser: true, todo: true, evil:true, devel: true, debug: true, nomen: true, plusplus: true, sloppy: true, vars: true, white: true, indent: 2 */
/*globals HANNIBAL_DEBUG, Engine, API3, print, uneval */

/*--------------- H A N N I B A L ---------------------------------------------

  This is loaded first by 0 A.D.
  Home: https://github.com/noiv/Hannibal/blob/master/README.md

  tested with 0 A.D. Alpha 17 Quercus
  V: 0.1, agentx, CGN, Nov, 2014

  Credits:

    kmeans: 
    helper:

*/

/* 
  loading sequence:
    _debug
    _hannibal
    _lhelper
    _logger
    a-z

*/


// very first line, enjoy the rest
print("--------: HANNIBAL.MODUL: " + new Date() + " --- ### --- ### --- ### ---\n");

Engine.IncludeModule("common-api");

var HANNIBAL = (function() {

  var H = {

    MODULESTART: Date.now(),

    API:      API3, 
    AI:       {}, 
    LIB:      {}, 
    HTN:      {Economy: {}, Helper: {}}, 
    DSL:      {Nouns: {}}, 
    Data:     {Groups: {}}, 
    Groups:   {},
    Geometry: {},
    
    throw: function(){
      var 
        msg = H.format.apply(null, H.toArray(arguments)),
        stack = new Error().stack.split("\n").slice(1);
      H.deb();
      H.deb(msg);
      stack.forEach(line => H.deb("  " + line));      
      throw "\n*\n*";
    },
    
    extend: function (o){
      Array.prototype.slice.call(arguments, 1)
        .forEach(e => {Object.keys(e)
          .forEach(k => o[k] = e[k]
    );});},
    
    chat: function(id, msg){
      Engine.PostCommand(id, {"type": "chat", "message": id + "::" + msg});
    },

  };

  /*

    MIXINS,

  */
  
  // Serializer needs: this.[klass, name, context, imports])
  H.LIB.Serializer = function(){};
  H.LIB.Serializer.prototype = {
    constructor: H.LIB.Serializer,
    toString: function(){return H.format("[%s %s:%s]", this.klass || "no klass", this.context.name, this.name || "no name");},
    deb: function(){this.context.launcher.deb.apply(this, arguments);},
    log: function(){this.deb("   %s: logging", this.name.slice(0,3).toUpperCase());},
    logtick: function(){this.deb("   %s: logticking", this.name.slice(0,3).toUpperCase());},
    serialize: function(){return {};},
    deserialize: function(){return this;},
    initialize: function(){return this;},
    finalize: function(){return this;},
    activate: function(){return this;},
    release: function(){
      if(!this.context.importer.delete(this)){
        this.deb("WARN  : Serializer.release: could not release: %s", this);
      }
      return this;
    },
    import: function(){
      this.context.importer.add(this); 
      this.imports.forEach(imp => this[imp] = this.context[imp]);
      return this;
    },
    clone: function(context){
      context.data[this.klass] = this.serialize();
      return new H.LIB[H.noun(this.name)](context);
    },
    exportJSON: function(){

      var 
        file, lines, count, 
        id = this.context.id,
        prefix = id + "::";

      function logg(){
        print( arguments.length === 0 ? 
          prefix + "#! append 0 ://\n" : 
          prefix + "#! append 0 :" + H.format.apply(H, arguments) + "\n"
        );
      }    

      if (
        HANNIBAL_DEBUG && 
        HANNIBAL_DEBUG.export && 
        HANNIBAL_DEBUG.bots[id].fil
        ){

        this.deb("INFO  : exporting: %s", this.name);

        file  = HANNIBAL_DEBUG.export + this.name + ".export";
        file  = file.split(":").join("-");
        lines = JSON.stringify(this.serialize(), null, "  ").split("\n");
        count = lines.length;

        this.deb();
        this.deb("EXPORT: %s lines, %s", file, count);

        print(H.format("%s#! open 0 %s\n", prefix, file));
        logg("// EXPORTED %s at %s", this.name, new Date());
        lines.forEach(line => logg(line));
        logg("// Export end of %s", this.name);
        print(H.format("%s#! close 0\n", prefix));
        // print("#! close 0\n");

        this.deb("EXPORT: Done");
        this.deb();

      } else {
        this.deb("INFO  : did not export %s", this.name);

      }

    }    
  };  

return H;}());
