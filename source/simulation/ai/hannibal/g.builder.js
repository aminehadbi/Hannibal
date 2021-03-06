/*jslint bitwise: true, browser: true, evil:true, devel: true, debug: true, nomen: true, plusplus: true, sloppy: true, vars: true, white: true, indent: 2 */
/*globals HANNIBAL, uneval */

/*--------------- GROUP:  B U I L D E R ---------------------------------------

  a group to build any buildings


  tested with 0 A.D. Alpha 18 Rhododactylus
  V: 0.1.1, agentx, CGN, Mar, 2015

*/


HANNIBAL = (function(H){

  H.extend(H.Groups, {

    "g.builder" : {

      /*
        Behaviour: 
          builds structures until quantity or
          builds houses until 
          try garrison on attack (female, male)
          try healing on hurt
          dissolve on nothing to do
          
      */

      active:         true,           // prepared for init/launch ...
      description:    "builder",      // text field for humans 
      civilisations:  ["*"],          // 
      interval:       5,              // call tick() every x ticks, prefer primes here


      // DSL World scripts

      scripts: {

        launch: function launch (w, config /* building, quantity */) {

          w.deb("     G: launch %s %s", this, uneval(config));

          w.buildings = ["shared",    config.building];
          w.units     = ["exclusive", config.building + " BUILDBY"];

          w.units.size     = w.units.size     || config.size     ||  5;
          w.buildings.size = w.buildings.size || config.quantity ||  1;

          w.nounify("units", "buildings");
          w.units.on.request();   

        
        // a request was successful

        }, assign: function assign (w, item) {

          // w.deb("     G: assign.0: %s, %s", w, item);

          w.nounify("item", item);

          // have too much units, exits
          w.units.on
            .gt(w.units.count, w.units.size)
            .release(w.item)
            .exit
          ;          

          // keep requesting units until size
          w.units.on
            .member(w.item)
            .lt(w.units.count, w.units.size)
            .request()
          ;

          //  the first unit requests structure to build, exits
          w.units.on
            .member(w.item)
            .match(w.units.count, 1)
            .match(w.buildings.count, 0)
            .buildings.do.request() 
            .exit
          ;

          // got unit, send to repair, exits
          w.units.on
            .member(w.item)
            .gt(w.buildings.count, 0)
            .item.do.repair(w.buildings)
            .exit
          ;

          // got foundation, all units repair, relocate on first, exits
          w.buildings.on
            .member(w.item)
            .match(w.item.foundation)
            .units.do.repair(w.item)
            .match(w.buildings.count, 1)
            .group.do.relocate(w.item.position)
            .exit
          ;

          // got a building check order next, exits
          w.buildings.on
            .member(w.item)
            .match(!w.item.foundation)
            .lt(w.buildings.count, w.buildings.size)
            .request()
            .exit
          ;

          // got a building, check job done, transfers exits
          w.buildings.on
            .member(w.item)
            .match(!w.item.foundation)
            .match(w.buildings.count, w.buildings.size)
            .units.do.transfer("g.idle")
            .group.do.dissolve()
            .echo("dissolved %s/%s", w.buildings.count, w.buildings.size)
            .exit
          ;


        }, destroy: function destroy (w, item) {

          w.deb("     G: destroy: %s, %s", this, uneval(item));

          w.nounify("item", item);

          // lost unit, request another
          w.units.on
            .member(w.item)
            .request()
          ;

          // lost foundation, request another
          w.buildings.on
            .echo("requesting foundation 00")
            .member(w.item)
            .echo("requesting foundation 01: %s", w.item.foundation)
            .match(w.item.foundation)
            .echo("requesting foundation 02")
            .request()
          ;


        // there are enemies and gaya

        }, attack: function attack (w, attacker, victim, type, damage){

          w.deb("     G: attack: %s, %s, %s", this, attacker, victim);

          w.nounify("attacker",  attacker, "victim", victim);

          // don't care about buildings, exits
          w.buildings.on
            .member(w.victim)
            .exit
          ;

          // // avoid loosing unit
          // w.units.on
          //   .echo("############ HEALTH 0 ###############")
          //   .member(w.item)
          //   .echo("############ HEALTH 1 ###############")
          //   .lt(w.item.health, 50)
          //   .echo("############ HEALTH 2 ###############")
          //   // .item.do.garrison()
          // ;

        }, radio: function radio (w, msg) {

          w.deb("     G: radio: %s, %s secs", w, msg);


        }, interval:  function interval (w, tick, secs) {

          // w.deb("     G: interval: %s, secs: %s, intv: %s", this, secs, this.interval);

          // w.units.on
          //   .doing("idle")
          //   .match(w.units.size)
          //   .group.do.dissolve()
          // ;

          // // avoid loosing units
          // w.units.on
          //   .doing("!garrison")
          //   .doing("!healing")
          //   .having("health < 30")
          //   .heal()
          // ;

        }

      } // end scripts

    }

  });

return H; }(HANNIBAL));

