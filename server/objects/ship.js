/*
  
  NodeGame: Orbit
  Copyright (c) 2010 Ivo Wetzel.
  
  All rights reserved.
  
  NodeGame: Orbit is free software: you can redistribute it and/or
  modify it under the terms of the GNU General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  NodeGame: Orbit is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
  GNU General Public License for more details.

  You should have received a copy of the GNU General Public License along with
  NodeGame: Orbit. If not, see <http://www.gnu.org/licenses/>.
  
*/


// Ships -----------------------------------------------------------------------
// -----------------------------------------------------------------------------
function Ship(game, type, planet, player, r, orbit) {
    this.$ = game;
    this.id = this.$.shipID++;
    this.player = player;
    this.player.shipCount++;
    
    this.type = type;
    this.typeID = this.$.shipTypes.indexOf(type);
    this.health = this.$.shipHealth[this.type];
    this.tickOffset = this.getTick();
    
    this.or = r;
    this.r = r;
    this.rs = 0;
    this.orbit = orbit ? this.$.shipOrbits[this.type] : 0;
    
    this.inOrbit = orbit;
    this.planet = planet;
    this.direction = this.planet.getPreferedDirection(player, this.type);
    this.planet.addShip(this);
    
    this.targetPlanet = null;
    this.nextPlanet = null;
    this.movePlanets = [];
    
    this.travelAngle = -1;
    this.traveling = false;
    this.traveled = false;
    this.travelTicks = 0;
    this.arriveTick = 0;
    
    this.updated = false;
    this.attacked = false;
}
exports.Ship = Ship;


// General ---------------------------------------------------------------------
Ship.prototype.destroy = function(keep) {
    this.player.shipCount--;
    this.health = 0;
    if (!keep) {
        this.planet.removeShip(this);
    }
};

Ship.prototype.attack = function(other) {
    if (!this.attacked && this.health > 0) {
        other.health -= this.$.shipDamage[this.type];
        if (other.health <= 0) {
            other.destroy();
        }
    }
    this.attacked = true;
};


// Commands --------------------------------------------------------------------
Ship.prototype.send = function(target) {
    this.movePlanets = this.$.corePath(this.planet, target, this.player);
    if (this.movePlanets.length > 0) {
        if (!this.nextPlanet) {
            this.traveled = false;
        }
        
        this.targetPlanet = this.movePlanets[this.movePlanets.length - 1];
        this.nextPlanet = this.movePlanets[0];
        this.travelAngle = Math.round(this.$.coreAngle(this.planet,
                                                       this.nextPlanet));
        
        this.updated = true;
        return true;
    
    } else {
        this.targetPlanet = null;
        this.nextPlanet = null;
        return false;
    }
};

Ship.prototype.stop = function() {
    if (this.nextPlanet && !this.traveling) {
        this.nextPlanet = this.targetPlanet = null;
        this.updated = true;
    }
};


// Updates ---------------------------------------------------------------------
Ship.prototype.tick = function() {
    this.attacked = false;
    
    // Orbit & Angle
    if (!this.traveling) {
        var tickDiff = this.getTick() - this.tickOffset;
        if (!this.inOrbit) {
            this.orbit = tickDiff * this.$.shipToOrbitSpeed[this.type];
            
            if (this.orbit >= this.$.shipOrbits[this.type]) {
                this.inOrbit = true;
                this.orbit = this.$.shipOrbits[this.type];
            }
        
        } else {
            this.orbit = this.$.shipOrbits[this.type];
        }  
        
        this.rs = this.getRotationSpeed();
        this.r = this.wrapAngle(this.or + this.direction * this.rs * tickDiff);
    }
    
    // Start Traveling
    if (this.inOrbit && this.nextPlanet !== null && !this.traveling) {
        var diff = this.$.coreDifference(this.r, this.travelAngle);
        if ((this.direction === 1 && diff > 0) || (this.direction === -1 && diff < 0)) {
            if (Math.abs(diff) < this.rs * 20 && Math.abs(diff) > this.rs * 10
                && this.nextPlanet.getPlayerShipCount(this.player) < this.nextPlanet.maxCount) {
                
                this.startTravel();
            }
        }
    }
    
    // Finish Traveling
    if (this.traveling && this.getTick() === this.arriveTick) {
        this.finishTravel();
    }
};

Ship.prototype.startTravel = function() {
    this.updated = true;
    this.or = this.r;
    this.tickOffset = this.getTick();
    this.travelTicks = Math.ceil(this.$.coreOrbit(this, this.planet, this.nextPlanet));
    this.planet.removeShip(this);
    
    // Calculate best direction on the next planet
    if (this.movePlanets.length > 1) {
        var travelAngle = Math.round(this.$.coreAngle(this.nextPlanet, this.movePlanets[1]));  
        var r = this.wrapAngle(this.travelAngle + 180);
        this.direction = this.$.coreDifference(r, travelAngle) >= 0 ? 1 : -1;
    
    } else {
        this.direction = this.nextPlanet.getPreferedDirection(this.player, this.type);
    }
    
    this.nextPlanet.addShip(this);
    this.arriveTick = this.getTick() + this.travelTicks;
    this.traveling = true;
    this.traveled = false;
};

Ship.prototype.finishTravel = function() {
    this.updated = true;
    this.traveling = false;
    this.traveled = true;
    this.tickOffset = this.getTick();
    
    var r = this.travelAngle + 180 + (this.rs * 15 * this.direction);
    this.r = this.or = this.wrapAngle(r);
    this.planet = this.nextPlanet;
    this.planet.checkAddShip(this);
    
    if (this.nextPlanet === this.targetPlanet) {
        this.nextPlanet = this.targetPlanet = null;
    
    } else if (!this.send(this.targetPlanet, this.getTick())) {
        this.nextPlanet = this.targetPlanet = null;
    
    } else {
        var dr = this.$.coreDifference(this.r, this.travelAngle);
        this.direction = dr >= 0 ? 1 : -1;
    }
};


// Helpers ---------------------------------------------------------------------
Ship.prototype.getTick = function() {
    return this.$.getTick();
};

Ship.prototype.getRotationSpeed = function() {
    return Math.round(Math.PI / this.planet.size
                      * this.$.shipSpeeds[this.type] * 100) / 100;
    
};

Ship.prototype.wrapAngle = function(r) {
    r = (r + 360) % 360;
    if (r < 0) {
        r += 360;
    }
    return r;
};

// Network ---------------------------------------------------------------------
Ship.prototype.toMessage = function(create) {
    var msg = [];
    
    // Ship Flags
    var flags = 0;
    flags += create ? 1 : 0;
    flags += this.traveling ? 2: 0;
    flags += this.inOrbit ? 4 : 0;
    flags += this.nextPlanet ? 16 : 0;
    flags += this.traveled ? 32 : 0;
    flags += this.direction === 1 ? 64 : 0;
    
    // Basic fields
    msg.push(flags);
    msg.push(this.id);
    
    // Ship created
    if (create) {
        msg.push(this.typeID);
        msg.push(this.planet.id);
        msg.push(this.player.id);
        msg.push(this.tickOffset);
        msg.push(this.or);
        
        // Ship created in travel
        if (this.nextPlanet && this.traveling) {
            msg.push(this.nextPlanet.id);
            msg.push(this.arriveTick);
            msg.push(this.travelTicks);
        
        // Ship created and already sent
        } else if (this.nextPlanet) {
            msg.push(this.nextPlanet.id);
        }
    
    // Ship Updates
    } else {
        
        // Ship sent
        if (this.nextPlanet && !this.traveling) {
            msg.push(this.nextPlanet.id);
            
            // Ship has just arrived
            if (this.traveled) {
                msg.push(this.tickOffset);
                msg.push(this.or);
                msg.push(this.planet.id);
            }
        
        // Ship starts travel
        } else if (this.nextPlanet && this.traveling) {
            msg.push(this.tickOffset);
            msg.push(this.or); 
            msg.push(this.nextPlanet.id);
            msg.push(this.arriveTick);   
            msg.push(this.travelTicks);
        
        // Ship finishes travel
        } else {
            msg.push(this.tickOffset);
            msg.push(this.or);
            msg.push(this.planet.id);
        }
    }
    return msg;
};

