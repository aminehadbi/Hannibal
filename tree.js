/*jslint bitwise: true, browser: true, todo: true, evil:true, devel: true, debug: true, nomen: true, plusplus: true, sloppy: true, vars: true, white: true, indent: 2 */
/*globals HANNIBAL, deb, logObject, uneval */

/*--------------- T E C H N O L G Y   T R E E  --------------------------------

  Models the dependencies of entities and technologies
  

  tested with 0 A.D. Alpha 15 Osiris
  V: 0.1, agentx, CGN, Feb, 2014

*/


HANNIBAL = (function(H){

  var phases = {
      "1" : {idx: 1, abbr: "vill", generic: "phase_village", alternates: ["vill", "phase_village"]},
      "2" : {idx: 2, abbr: "town", generic: "phase_town",    alternates: ["town", "phase_town"]},
      "3" : {idx: 3, abbr: "city", generic: "phase_city",    alternates: ["city", "phase_city"]},
      find: function(phase){
        for (var i=1; i<=3; i++) {
          if (H.contains(phases[i].alternates, phase)){
            return phases[i];
          }
        } /* deb("WARN  : unknown phase: %s", phase); */ return undefined;
      },
      prev: function(phase){return phases[(phases.find(phase).idx - 1) || 1];},
      update: function(){
        var test;
        function extract(str){
          if (str && str.contains("phase")){
            if (str.contains("village")){phases["1"].alternates.push(str);}
            if (str.contains("town")){phases["2"].alternates.push(str);}
            if (str.contains("city")){phases["3"].alternates.push(str);}
          }
        }
        function check(key, tpl){
          if ((test = H.test(tpl, "Identity.RequiredTechnology"))){extract(test);}
          if ((test = H.test(tpl, "requirements.tech"))){extract(test);}
          if ((test = H.test(tpl, "requirements.any"))){test.forEach(t => extract(t.tech));}
        }
        H.each(H.Templates, check); 
        H.each(H.TechTemplates, check); 
        phases["1"].alternates = H.unique(phases["1"].alternates);
        phases["2"].alternates = H.unique(phases["2"].alternates);
        phases["3"].alternates = H.unique(phases["3"].alternates);
      }
    };


  H.TechTree = function (idplayer) {
    phases.update(); // needs better place
    this.id = idplayer;
    this.civ = H.Players[idplayer].civ;
    this.nodes = {};
    this.sources = [].concat(
      H.attribs(H.Players[idplayer].researchedTechs), 
      H.attribs(H.SharedScript._techModifications[idplayer]),
      H.attribs(H.Entities)
        .filter(id => H.Entities[id].owner() === idplayer)
        .map(id => H.Entities[id]._templateName)
    );    
    this.sources = H.unique(this.sources).map(src => [0, src]);
    deb();deb();
    deb("  TREE: expanding %s sources for id: %s with civ: %s", H.count(this.sources), this.id, this.civ);
    this.expand();
    deb("     T: found %s nodes", H.count(this.nodes));
    this.enhance();
    this.names = H.attribs(this.nodes);
    this.keys  = H.attribs(this.nodes).map(t => this.nodes[t].key);
    deb("     T: phases: 1 %s", uneval(phases["1"].alternates));
    deb("     T: phases: 2 %s", uneval(phases["2"].alternates));
    deb("     T: phases: 3 %s", uneval(phases["3"].alternates));
  };

  H.TechTree.prototype = {
    constructor: H.TechTree,
    log: function (filters){

      var t, tt = this.nodes, tpls = H.attribs(this.nodes);

      filters = filters || ["tech", "unit", "stuc"];

      deb(); deb("  TREE: logging %s/%s", this.id, this.civ);

      tpls.sort(function(a, b){
        if (tt[a].phase !== tt[b].phase){
          return phases.find(tt[a].phase).idx > phases.find(tt[b].phase).idx;
        } else {
          return tt[a].depth > tt[b].depth;
        }
      });

      tpls.forEach(function(tpln){
        t = tt[tpln];
        if (H.contains(filters, t.type)) {
          deb("     T: %s / %s %s %s %s", H.tab(t.depth, 4), H.tab(t.operations, 4), t.type, t.phase, t.name);
          deb("     T:        %s", t.key);
          deb("     T:        reqs: %s", t.requires || "none");
          deb("     T:        verb: %s", t.verb || "none");
          if (t.producers.length){
            t.producers.forEach(p => {
              deb("     T:          %s", p.name);
            });
          } else {
            deb("     T:        NO PRODUCER");
          }
        }
      });
      deb("  TREE: Done ...");

    },
    finalize: function(){

      var tech, name, producers, nodes = this.nodes, t0 = Date.now();

      var operMapper = {
        "BUILDBY":       "build_structures",
        "TRAINEDBY":     "train_units",
        "RESEARCHEDBY":  "research_tech"
      };

      var verbMapper = {
        "BUILD":    "BUILDBY",
        "TRAIN":    "TRAINEDBY",
        "RESEARCH": "RESEARCHEDBY"
      };

      H.QRY("ENABLE DISTINCT").forEach(node => {
        tech = H.QRY(node.name + " REQUIRE").first().name;
        nodes[node.name].requires = tech;
      });

      "TRAIN BUILD RESEARCH".split(" ").forEach(verb => {
        H.QRY(verb + " DISTINCT").forEach(ent => {
          producers = H.QRY(ent.name + " " + verbMapper[verb]).execute();
          producers.forEach(p => nodes[ent.name].producers.push(p));
          nodes[ent.name].verb = verb.toLowerCase();
          nodes[ent.name].operator = H.HTN.Economy.operators[operMapper[verbMapper[verb]]];
        });
      });  

      H.QRY("PAIR DISTINCT").forEach(tech => {  

        if (!nodes[tech.name]){return deb("ERROR  : unknown paired tech: %s in tree.finalize", tech.name);}

        producers = H.QRY(tech.name + " PAIREDBY RESEARCHEDBY");
        producers.forEach(p => nodes[tech.name].producers.push(p));
        nodes[tech.name].verb = "research";
        nodes[tech.name].operator = H.HTN.Economy.operators.research_tech;

      });          

      H.QRY("SUPERSEDE DISTINCT").forEach(tech => {  

        if (!nodes[tech.name]){return deb("ERROR  : unknown superseded tech: %s in tree.finalize", tech.name);}

        producers = H.QRY(tech.name + " SUPERSEDEDBY RESEARCHEDBY");
        producers.forEach(p => nodes[tech.name].producers.push(p));
        nodes[tech.name].verb = "research";
        nodes[tech.name].operator = H.HTN.Economy.operators.research_tech;

      });          

      H.range(1, 4).forEach(n => {
        phases[n].alternates.forEach(a => {
          name = H.saniTemplateName(a);
          if (nodes[name] && !nodes[name].verb){
            nodes[name].verb = "research";
            deb("     T: setting verb for %s", name);
          }
        })
      });

      H.each(nodes, function(name, node){
        node.producers = H.unique(node.producers);
      });

      deb("  TREE: finalized %s msecs, %s nodes", Date.now() - t0, H.count(nodes));

    },
    getType: function(tpln){
      if (H.TechTemplates[tpln]){return "tech";}
      if (tpln.contains("units/")){return "unit";}
      if (tpln.contains("structures/")){return "stuc";}
      if (tpln.contains("other/")){return "othr";}
      if (tpln.contains("gaia/")){return "gaia";}
      if (tpln.contains("pair_")){return "pair";}
      return "XXXX";
    },
    getPhase: function(tpln, space){

      var test, phase = "phase_village", tpl = H.Templates[tpln] || H.TechTemplates[tpln];

      space = space || "";

      if ((test = H.test(tpl, "Identity.RequiredTechnology"))){
        phase = test;
      } else if ((test = H.test(tpl, "requirements.any"))){
        phase = test[0].tech;
      } else if ((test = H.test(tpl, "requirements.tech"))){
        phase = test;
      } else if (phases.find(tpln)){
        phase = phases.prev(tpln).generic;
      } else if (tpl.top) {
        return this.getPhase(tpl.top, space + "  ");
      }

      // deb("     P:%s %s -> %s", space, tpln, phase);

      if (!phases.find(phase)){
        return this.getPhase(phase, space + "  ");
      } else {
        return phase;
      }


    },
    enhance: function (){

      H.each(this.nodes, function(name, template){

        var 
          type  = this.getType(template.key),
          phase = phases.find(this.getPhase(template.key)).abbr;

        template.type  = type;
        template.phase = phase;

        // deb("%s %s, %s", phase, type, name);

      }.bind(this));

    },
    expand: function (){

      var tpln, key, tpl, name, src, depth = 0,
          push = function(item){this.sources.push([depth, item]);}.bind(this);

      while (this.sources.length){

        src  = this.sources.shift();
        tpln = src[1];
        key  = tpln.replace(/\{civ\}/g, this.civ);
        tpl  = H.Templates[key] || H.TechTemplates[key];
        name = H.saniTemplateName(key);

        if (!this.nodes[name]){

          this.nodes[name] = {
            name:        name,    // sanitized API template name
            key:         key,     // API template name
            template:    tpl,     // API template
            depth:       src[0],
            operations:  0,       // planning depth
            type:        "",      // tech, unit, stuc
            phase:       "",      // vill, town, city
            requires:    "",      // sanitized tech template name
            producers:   [],      // [nodes], "verb", 
            verb:        "",      // train, build, research
            operator:    null,    // planner.operation
          };

          // deb("     T: %s, %s, %s ----- %s", typeof tpl, !!tpl, name, key);

          if(key.slice(-2) === "_b"){
            push(key.slice(0, -2) + "_e");
            push(key.slice(0, -2) + "_a");
          }

          // can research tech
          if (tpl.ProductionQueue && tpl.ProductionQueue.Technologies && tpl.ProductionQueue.Technologies._string){
            tpl.ProductionQueue.Technologies._string.split(" ").forEach(push);
          }

          // can train ents
          if (tpl.ProductionQueue && tpl.ProductionQueue.Entities && tpl.ProductionQueue.Entities._string){
            tpl.ProductionQueue.Entities._string.split(" ").forEach(push);
          }

          // can build structs
          if (tpl.Builder && tpl.Builder.Entities && tpl.Builder.Entities._string){
            tpl.Builder.Entities._string.split(" ").forEach(push);
          }

          // needs tech
          if (tpl.Identity && tpl.Identity.RequiredTechnology){
            push(tpl.Identity.RequiredTechnology);
          }

          // is tech
          if (tpl.supersedes){push(tpl.supersedes);}
          if (tpl.bottom){push(tpl.bottom);}
          if (tpl.top){push(tpl.top);}

          depth += 1;

        }

      }

    }

  };


return H; }(HANNIBAL));
