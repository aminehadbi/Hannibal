/*jslint bitwise: true, browser: true, todo: true, evil:true, devel: true, debug: true, nomen: true, plusplus: true, sloppy: true, vars: true, white: true, indent: 2 */
/*globals Engine, HANNIBAL, Uint8Array, Uint32Array, deb, logObject */

/*--------------- G R I D -----------------------------------------------------

  A thin API onto UintArrays, used by the map module




  V: 1.1, noiv11, CGN, Feb, 2014

*/

HANNIBAL = (function(H){

  var t0, width, height, length, cellsize, 
      maskOpen,
      maskWater,
      maskLand,
      maskBldgShore,
      maskBldgLand,
      maskFoundation,
      maskPathfinder,
      square = [[-1,-1],[-1,0],[-1,1],[0,1],[1,1],[1,0],[1,-1],[0,-1],[0,0]],
      grids = {
        food: null,
        wood: null,
        stone: null,
        metal: null,
        territory: null,
        passability: null,  // Uint16Array 
        obstruction: null, // Trees, Geology
        landPass: null,
        navalPass: null,
        attack: null,
      };

  function dump(name, grid, threshold){
    threshold = threshold || grid.max() || 255;
    name = H.format("%s-%s.png", name, threshold);
    Engine.DumpImage(name, grid.data, grid.width, grid.height, threshold);    
    deb("  GRID: dumping %s, w: %s, h: %s, t: %s", name, grid.width, grid.height, threshold);
  }

  function gamePosToMapPos(p){return [~~(p[0] / cellsize), ~~(p[1] / cellsize)];}

  function gridFromMap(map){
    var grid;
    if (map instanceof Uint8Array){
      grid = new H.Grid(width, height, 0);
      grid.data = map;
    } else if (map.data){
      grid = new H.Grid(map.width, map.height, 0);
      grid.data = map.data;
    } else if (map.map instanceof Uint8Array){
      grid = new H.Grid(map.width, map.height, 0);
      grid.data = map.map;
    } else {
      deb(" ERROR: gridFromMap: can't handle map");
      // logObject(map, "gridFromMap.map");
    }
    return grid;
  }


  H.Grids = (function(){

    var self;

    return {
      init: function(){

        width  = H.SharedScript.passabilityMap.width;
        height = H.SharedScript.passabilityMap.height;
        length = width * height;
        cellsize = H.GameState.cellSize;
        
        // http://trac.wildfiregames.com/wiki/AIEngineAPI
        maskOpen  = H.SharedScript.passabilityClasses["unrestricted"];      // 64
        maskWater = H.SharedScript.passabilityClasses["ship"];              // 32
        maskLand  = H.SharedScript.passabilityClasses["default"];           // 16
        maskBldgShore   = H.SharedScript.passabilityClasses["building-shore"];           // 8
        maskBldgLand    = H.SharedScript.passabilityClasses["building-land"];            // 4
        maskFoundation  = H.SharedScript.passabilityClasses["foundationObstruction"];    // 2
        maskPathfinder  = H.SharedScript.passabilityClasses["pathfinderObstruction"];    // 1

        grids.attack = new H.Grid(width, height, 8);
        
        deb();deb();
        deb("  GRID: init w: %s, h: %s, cellsize: %s", width, height, cellsize);
      },
      tick: function(secs){
        t0 = Date.now();
        grids.food  = gridFromMap(H.SharedScript.resourceMaps.food);
        grids.wood  = gridFromMap(H.SharedScript.resourceMaps.wood);
        grids.stone = gridFromMap(H.SharedScript.resourceMaps.stone);
        grids.metal = gridFromMap(H.SharedScript.resourceMaps.metal);
        grids.territory   = gridFromMap(H.Bot.gameState.ai.territoryMap);
        grids.passability = gridFromMap(H.SharedScript.passabilityMap);
        grids.landPass    = gridFromMap(H.GameState.sharedScript.accessibility.landPassMap);
        grids.navalPass   = gridFromMap(H.GameState.sharedScript.accessibility.navalPassMap);
        grids.obstruction = obstructions();
        grids.attack.divVal(H.Config.attackRelax);
        return Date.now() - t0;
      },
      record: function(what, where){
        var [x, y] = where;
        if (what === "Attacked"){
          grids.attack.data[x + y * width] += 1;
        }
      },
      dump: function(){
        H.each(grids, function(name, grid){
          if (grid){dump(name, grid);}
        });
      }

    };


  }());

  H.Grid = function (width, height, bits){

    // subarray, set, move, length, byteOffset, byteLength, buffer

    this.width  = width; 
    this.height = height;
    this.length = width * height;
    this.bits = bits;
    this.data = (
      this.bits ===  0 ? new Uint8Array(0) :
      this.bits ===  8 ? new Uint8Array(width  * height) :
      this.bits === 32 ? new Uint32Array(width * height) : null
      // Uint8ClampedArray
    );

  };

  H.Grid.prototype = {
    constructor: H.Grid,
    max:     function(){var m = 0, g=this.data, l = this.length;while(l--){m=(g[l]>m)?g[l]:m;}return m;},
    // all destructive
    setVal:  function(val){var g=this.data,l=this.length;while(l--){g[l]  = val;}return this;},
    addVal:  function(val){var g=this.data,l=this.length;while(l--){g[l] += val;}return this;},
    mulVal:  function(val){var g=this.data,l=this.length;while(l--){g[l] *= val;}return this;},
    divVal:  function(val){var g=this.data,l=this.length;while(l--){g[l]  = ~~(g[l]/val);}return this;},
    addGrid: function(grd){var g=this.data,l=this.length;while(l--){g[l] += grd[l];}return this;},
    copy: function(){
      return (
        this.bits ===  8 ? new Uint8Array(this.data.buffer.slice()) : 
        this.bits === 32 ? new Uint32Array(this.data.buffer.slice()) : null
      );
    },
    dump: function(name, threshold){
      name = name || "default.png";
      threshold = threshold || this.maxVal;
      Engine.DumpImage(name, this.map, this.width, this.height, threshold);
    },


  };

  function obstructions(){

    var i, len, ents, ent, 
        x, y, xx, yy, sq, radius, pointer, value, 
        passMap = grids.passability,
        passData = passMap.data,
        obstGrid = new H.Grid(width, height, 8),
        obstData = obstGrid.data;

    /* Generated map legend:
     0 is impassable
     200 is deep water (ie non-passable by land units)
     201 is shallow water (passable by land units and water units)
     255 is land (or extremely shallow water where ships can't go).
     40 is "tree".
     The following 41-49 range is "near a tree", with the second number showing how many trees this tile neighbors.
     30 is "geological component", such as a mine
    */

    i = length;

    while(i--){
      obstData[i] = (passData[i] & maskLand) ? 0 : 255;
      obstData[i] = (
        (!(passData[i] & maskWater) && obstData[i] === 0)   ? 200 :
        (!(passData[i] & maskWater) && obstData[i] === 255) ? 201 : 
          obstData[i]
      );
    }

    ents = Object.keys(H.Entities);
    len  = ents.length;

    for (i=0;i<len;i++){

      ent = H.Entities[ents[i]];

      if (ent.hasClass("ForestPlant")) {

        [x, y] = gamePosToMapPos(ent.position());

        if (obstData[x + y * width] !== 0){obstData[x + y * width] = 40;}
        
        for (sq in square){

          xx = square[sq][0];
          yy = square[sq][1];
          
          if (x+xx >= 0 && x+xx < width && y+yy >= 0 && y+yy < height) {
            pointer = (x+xx) + (y+yy) * width;
            value = obstData[pointer];
            obstData[pointer] = (
              (value === 255)            ? 41 : 
              (value < 49 && value > 40) ? value + 1 : value
            );
          }

        }        

      } else if (ent.hasClass("Geology")) {

        radius = ~~(ent.obstructionRadius() / 4);
        [x, y] = this.gamePosToMapPos(ent.position());

        // Unless it's impassable, mark as 30. This takes precedence over trees.
        obstData[x + y * width] = obstData[x + y * width] === 0 ? 0 : 30; //??

        for (xx = -radius; xx <= radius; xx++){
          for (yy = -radius; yy <= radius; yy++){
            if (x+xx >= 0 && x+xx < width && y+yy >= 0 && y+yy < height){
              obstData[(x+xx) + (y+yy) * width] = obstData[(x+xx) + (y+yy) * width] === 0 ? 0 : 30; //??
            }
          }
        }

      }
    }

    return obstGrid;

  }

return H; }(HANNIBAL));

// Object [unidentified] : ss.resourceMaps['food']  ---------------
// Object  constructor: (function Map(sharedScript, originalMap, actualCopy){"use st
//   cellSize: NUMBER (4)
//   height: NUMBER (256)
//   length: NUMBER (65536)
//   map: OBJECT [65536](0, 1, 2, 3, 4, ...)
//   maxVal: NUMBER (255)
//   width: NUMBER (256)
// Object.__proto__
//   add: (function (map){"use strict";  for (var i = 0; i < this.leng
//   addInfluence: (function (cx, cy, maxDist, strength, type) {"use strict";  
//   dumpIm: (function (name, threshold){"use strict";  name = name ? nam
//   expandInfluences: (function (maximum, map) {"use strict";  var grid = this.map
//   findBestTile: (function (radius, obstructionTiles){"use strict";  // Find 
//   findLowestNeighbor: (function (x,y) {"use strict";  var lowestPt = [0,0];  var l
//   gamePosToMapPos: (function (p){"use strict";  return [Math.floor(p[0]/this.ce
//   multiply: (function (map, onlyBetter, divider, maxMultiplier){"use str
//   multiplyInfluence: (function (cx, cy, maxDist, strength, type) {"use strict";  
//   point: (function (p){"use strict";  var q = this.gamePosToMapPos(p)
//   setInfluence: (function (cx, cy, maxDist, value) {"use strict";  value = v
//   setMaxVal: (function (val){"use strict";  this.maxVal = val; })
//   sumInfluence: (function (cx, cy, radius){"use strict";  var x0 = Math.max(



// Object [unidentified] : H.Bot.gameState.ai.territoryMap  ---------------
// Object  constructor: function Object() {    [native code]}
//   data: OBJECT [65536](0, 1, 2, 3, 4, ...)
//   height: NUMBER (256)
//   width: NUMBER (256)


// Object [unidentified] : sharedScript.passabilityClasses  ---------------
// Object  constructor: function Object() {    [native code]}
//   pathfinderObstruction: NUMBER (1)
//   foundationObstruction: NUMBER (2)
//   building-land: NUMBER (4)
//   building-shore: NUMBER (8)
//   default: NUMBER (16)
//   ship: NUMBER (32)
//   unrestricted: NUMBER (64)
