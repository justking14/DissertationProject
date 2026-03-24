import { db } from "./firebaseConfig.js";
import { ref, get, set, update, onValue } from "https://www.gstatic.com/firebasejs/9.21.0/firebase-database.js";

export default class MetricHandler {
     constructor(email, highCompetence, highAutonomy) {
          this.email = email.replace(/\./g, '_');

          //this.userRef = ref(db, `users/${this.email}/metrics${highCompetence,highAutonomy}`);
          this.userRef = ref(db, `HC:${highCompetence} HA:${highAutonomy} users/${this.email}/metrics`);

          this.highCompetence = highCompetence;
          this.highAutonomy = highAutonomy

          this.currentGame = {
               currency: 0,
               totalCurrencyGeneratedPreReset: 0,
               generatorCount: Array(14).fill(0),
               generatorCosts:       [10, 100, 1100, 12000,  130000, 1400000, 20000000, 330000000, 5100000000, 75000000000, 1000000000000, 14000000000000, 170000000000000, 5000000000000000],
               //linearGeneratorCosts: [10, 100,  500,  3000,   20000,  150000,  1200000,  10000000,   90000000,   900000000,    9500000000,   120000000000,   1800000000000,   30000000000000],
               //linearGeneratorCosts: [10, 100,  500,  3000,   15000,   50000,   150000,    400000,    1000000,     2500000,       6000000,       15000000,        35000000,         75000000],
               linearGeneratorCosts: [10, 100,  500,  3000,   15000,   50000,   150000,    450000,     1000000,     3500000,       8000000,        20000000,        50000000,         200000000],

               //linearGeneratorCosts: [10, 100, 1000,  7500,  60000,  500000,  4000000, 35000000,   300000000,  2500000000,   20000000000,   180000000000,   1600000000000,   14000000000000]
               //linearGeneratorCosts: [10, 100, 1000,  7500,  60000,  500000,  5000000, 50000000,   600000000,  7500000000,   90000000000,  1100000000000,  14000000000000,  180000000000000],


               ascensionScore: 1,
               nextAscensionScore: 0

          }



          this.fullweek = {
               clickCount: 0,
               interactionCount: 0,
               totalCurrencyGenerated: 0,
               generatorsPurchased: Array(14).fill(0),
               totalGeneratorsPurchased: 0,
               ascensionsPerformed: 0,
               gameRuntime: 0,
               focusTime: 0,
               dayCount: 0,
               numberOfLinksClicked: 0,
               exitSurveyClicked: 0,
          }

          this.dailyMetrics = {}

          this.session = {
               start: null, // Timestamp when session starts
               count: 0,// Number of sessions
               activeCount: 0,//number of sessions where the player did something
               lengths: [],//based on start time
               activeLengths: [], //based on last interaction time

               averageLength: 0,
               averageActiveLength: 0,
               lastInteraction: null, // Timestamp of last interaction
          }
          
          this.aCurrentStatus = "playing"

          this.c_timeBeforeSessionEnded = 180

          //have price per generator increase differently between groups
          this.costIncrement = 1.15
          if (this.highCompetence === false) {
               this.costIncrement = 1.15
          }

          //vary cost of ascending between groups 
          this.c_ascensionThreshold = 500000
          if (this.highCompetence === false) {
              this.c_ascensionThreshold = 25000
          }

          this.c_ascensionBonus = 0.05
          if (this.highCompetence === false){
               this.c_ascensionBonus = 0.1
          }

          this.lastInteractionTime = Date.now();
          this.lastTick = null//used to track offline time
          this.sessionActive = true;//check if currently active 

          this.focusStartTime = null;

          this.dayTracker = new Set();
          
          this.hasLoaded = false;
     }

     //load play data from firebase or start a new save
     async loadMetrics() {
          try {
               console.log("🔄 Loading user metrics...");
               onValue(this.userRef, (snapshot) => {
                    if (snapshot.exists()) {
                         Object.assign(this, snapshot.val());
                         this.dayTracker = new Set(this.dayTracker);
                         this.session.start = Date.now();

                         console.log("✅ Metrics loaded successfully.");

                    } else {
                         console.log(`⚠️ No previous metrics found for ${this.email}, starting fresh.`);
                    }
     
                    //only once data is loaded or found to exist can the game start running and saving
                    this.hasLoaded = true;
                    document.getElementById('game').removeAttribute("hidden");
                    document.getElementById('center-text').style.display = "none"

               }, { onlyOnce: true });
          } catch (error) {
               console.error("❌ Error loading metrics:", error);
          }
     }

     //check if metric for today exists, create it if it doesn't, and and return it
     todaysMetric() {
          let day = new Date().toDateString()
          if (!this.dailyMetrics[day]) { this.createDailyMetric(day) }
          this.fullweek.dayCount = this.dayTracker.size
          return this.dailyMetrics[day]
     }
     //set up a metric for keeping track of todays actions
     createDailyMetric(today) {
          this.dailyMetrics[today] = {
               clickCount: 0,
               interactionCount: 0,
               totalCurrencyGenerated: 0,
               generatorsPurchased: Array(14).fill(0),
               totalGeneratorsPurchased: 0,
               ascensionsPerformed: 0,
               gameRuntime: 0,
               focusTime: 0,
                              
               linkClickedToday: false,
          };
     }

     //how much of a boost do ascension points give me?
     getAscensionBonus() {
          let bonus = ((this.currentGame.ascensionScore - 1) * this.c_ascensionBonus)
          return 1 + bonus
     }
     //update ascension score and restart game
     handleAscension() {
          this.currentGame.ascensionScore = this.currentGame.nextAscensionScore
          this.resetCurrentGame();
          this.recordInteraction();

          this.fullweek.ascensionsPerformed++;
          this.todaysMetric().ascensionsPerformed++
     }

     //calculate PP, percentage of bonus increase, and % to next threshold 
     ascensionCalculator() {
          //# of PP given if i reset right now
          //let prestigePointsGivenOnReset =
            //   Math.floor(Math.sqrt(this.currentGame.totalCurrencyGeneratedPreReset / this.c_ascensionThreshold));
          
          //let prestigePointsGivenOnReset = Math.floor(100 * (Math.sqrt(this.currentGame.totalCurrencyGeneratedPreReset / this.c_ascensionThreshold) - 1));
          let prestigePointsGivenOnReset = Math.floor(Math.sqrt(this.currentGame.totalCurrencyGeneratedPreReset / this.c_ascensionThreshold));

          this.currentGame.nextAscensionScore = prestigePointsGivenOnReset;

          //how big of a % increase would i get if reset now?
          let current_total_earnings = 1 * (1 + this.c_ascensionBonus * this.currentGame.ascensionScore)
          let new_total_earnings =     1 * (1 + this.c_ascensionBonus * prestigePointsGivenOnReset)
          let percentage_increase = ((new_total_earnings - current_total_earnings) / current_total_earnings) * 100

          //how much currency is needed to reach next PP
          let nextPrestigeThreshold = Math.pow((this.currentGame.ascensionScore + 1), 2) * this.c_ascensionThreshold;

          // If PP > current ascension score, how much currency is needed to reach next PP threshold
          if (prestigePointsGivenOnReset > this.currentGame.ascensionScore) {
               nextPrestigeThreshold = Math.pow((prestigePointsGivenOnReset + 1), 2) * this.c_ascensionThreshold;
          }
          //how close (in %) am I to reaching next threshold 
          let progressToNextPrestige = (this.currentGame.totalCurrencyGeneratedPreReset / nextPrestigeThreshold) * 100;

          return [prestigePointsGivenOnReset, percentage_increase, progressToNextPrestige]
     }

     //reset current game variables 
     resetCurrentGame() {
          this.currentGame = {
               currency: 0,
               totalCurrencyGeneratedPreReset: 0,
               generatorCount: Array(14).fill(0),
               generatorCosts:       [10, 100, 1100, 12000,  130000, 1400000, 20000000, 330000000, 5100000000, 75000000000, 1000000000000, 14000000000000, 170000000000000, 5000000000000000],
               //linearGeneratorCosts:  [10, 100,  750,  5000,  35000, 275000, 2200000, 19000000,170000000, 1500000000, 13000000000,  115000000000,  1000000000000,  9000000000000],
               //linearGeneratorCosts: [10, 100,  750,  5000,  35000,  275000,  2200000,  19000000,  170000000,  1500000000,   13000000000,   115000000000,   1000000000000,    9000000000000],
               ///linearGeneratorCosts: [10, 100,  500, 3000,   20000,  150000,  1200000,  10000000,   90000000,   900000000,    9500000000,   120000000000,   1800000000000,   30000000000000],
               linearGeneratorCosts: [10, 100,  500,  3000,   15000,   50000,   150000,    450000,     1000000,     3500000,       8000000,        20000000,        50000000,         200000000],

               ascensionScore: this.currentGame.ascensionScore,
               nextAscensionScore: this.currentGame.nextAscensionScore,
          };
     }

     //begin a new session 
     startSession() {
          this.session.start = Date.now()
          this.session.lastInteraction = Date.now();

          const today = new Date().toDateString();
          this.dayTracker.add(today);

          //create a daily metric for today
          this.todaysMetric()

          this.focusStartTime = Date.now();
          this.sessionActive = true;
          this.aCurrentStatus = "session started"
          console.log('Session started ');
     }

     //end the session 
     endSession() {
          if(this.hasLoaded === false){return}
          console.log("End session stuff ", this.session.activeLengths, this.lastInteractionTime, this.focusStartTime, this.session.start)

          //this.aCurrentStatus = "Session Ended"
          const now = Date.now()

          //if you had focus time during this session, add it to the total time spent in focus 
          if (this.focusStartTime) {
               let focusDuration = Math.floor((now - this.focusStartTime) / 1000)
               this.fullweek.focusTime += focusDuration;
               this.todaysMetric().focusTime = this.todaysMetric().focusTime + focusDuration
               this.focusStartTime =  null;
          }

          // Validate session start time
          if (!this.session.start || this.session.start > now) {
               console.error("Invalid session start time detected. Resetting to current time.");
               this.session.start = now; // Reset if invalid
          }

          let elapsedTime = (now - this.session.start) / 1000
          if (elapsedTime > 17387765) {
               console.error("ERRROR ", this.session.start, elapsedTime)
          }
          console.log('Session ended', (now - this.session.start) / 1000);

          if (elapsedTime > 1) {
               this.session.lengths.push(Math.max(elapsedTime, 1)); // Ensure a minimum session length of 1
               this.session.averageLength = getAverage(this.session.lengths)
               this.session.count = this.session.lengths.length
          }
               
          // Calculate active session length
          if (this.lastInteractionTime) {
               let activeLength = (this.lastInteractionTime - this.session.start) / 1000
               //if activelength is too short to be recorded properly, set it to 1
               if (activeLength > 1) {
                    this.session.activeLengths.push(activeLength)
                    this.session.averageActiveLength = getAverage(this.session.activeLengths)
                    this.session.activeCount = this.session.activeLengths.length
               }

          }

          //reset session length checks
          this.lastInteractionTime = now
          this.session.start = now 
          this.sessionActive = false;
     }

     //check if theres a null or undefined value 
     checkForNullUndefined(obj) {
          for (const key in obj) {
               if (obj[key] === null || obj[key] === undefined) {
                    console.log(obj, key, obj[key])
                    alert("Object contains null or undefined value.", obj, key, obj[key]);
                    return;
               }
          }
     }

     //how many generators of type i do i own
     getGeneratorCount(index) { return this.currentGame.generatorCount[index] }
     
     //how much do the generators cost
     getGeneratorCost(index) {
          if (this.highCompetence) {
               return this.currentGame.generatorCosts[index]
          } else {
               return this.currentGame.linearGeneratorCosts[index]
          }
     }

     //if possible, buy a generator of type i
     buyGenerator(index) {

          //check if affordable
          if (this.currentGame.currency < this.getGeneratorCost(index)) { return false }          

          playSound("buySound")

          this.currentGame.currency -= this.getGeneratorCost(index);
          this.currentGame.generatorCount[index] += 1

          //update costs of next generator based on experimental condition 
          if (this.highCompetence) {
               this.currentGame.generatorCosts[index] =
                    Math.floor(this.getGeneratorCost(index) * this.costIncrement);
          } else {
               this.currentGame.linearGeneratorCosts[index] =
                    Math.floor(this.getGeneratorCost(index) * this.costIncrement);
          }

          this.trackGeneratorPurchase(1, index)
          this.recordInteraction()
          return true
     }

     //how many can i buy?
     calculateMaxCountAndCost(index) {
          //get cost of next generator based on experimental condition 
          let cost = this.currentGame.generatorCosts[index]
          if (this.highCompetence === false) {
               cost = this.currentGame.linearGeneratorCosts[index]
          }

          //what is total amount? add updated costs together
          let total = 0, count = 0;
          while (this.currentGame.currency >= total + cost) {
               total += cost;
               cost = Math.floor(cost * this.costIncrement);
               count++;
          }
          return [count, total];
     }

     buyMaxGenerators(index) {
          playSound("buyMaxSound")

          let [maxCanBuy, totalCost] = this.calculateMaxCountAndCost(index)

          //purchase as many generators as possible and update their costs 
          if (this.currentGame.currency < totalCost) { return false }

          this.currentGame.currency -= totalCost;
          this.currentGame.generatorCount[index] += maxCanBuy

          //update cost for each generator purchased
          for (let i = 0; i < maxCanBuy; i++) {
               if (this.highCompetence) {
                    this.currentGame.generatorCosts[index] =
                         Math.floor(this.getGeneratorCost(index) * this.costIncrement);
               } else {
                    this.currentGame.linearGeneratorCosts[index] =
                         Math.floor(this.getGeneratorCost(index) * this.costIncrement);
               }
          }

          this.trackGeneratorPurchase(maxCanBuy, index)
          this.recordInteraction()
          return maxCanBuy
     }

     //clicking generates 20% of 1 second of passive progression, effectively doubling production if clicked rapidly enough
     clickForCurrencyAmount(linearGeneratorRates, generatorRates) {
          return 1 + ((this.generateOfflineEarnings(2, linearGeneratorRates, generatorRates)/2) * 0.2)

     }
     clickForCurrency(linearGeneratorRates, generatorRates) {
          playSound("clickSound")

          let oneSecEarning = this.clickForCurrencyAmount(linearGeneratorRates, generatorRates)
          //console.log(oneSecEarning)
          this.updateCurrency(oneSecEarning)
          this.trackClicks();
          this.recordInteraction();
     }
     trackClicks() {
          this.fullweek.clickCount++;
          this.todaysMetric().clickCount++
     }
     recordInteraction() {
          //keeps track of total interaction count 
          this.lastInteractionTime = Date.now();

          // and use last time to check if a session ended
          this.fullweek.interactionCount++;
          this.todaysMetric().interactionCount++

          //if i haven't started a new session, then start it on click 
          if (!this.sessionActive) {
               this.startSession()
          }
     }
     checkInteractionTime() {
          //check if more than 3 minutes have passed since last interaction 
          //console.log(this.sessionActive, (Date.now() - this.lastInteractionTime)/1000)
          if (this.sessionActive && (Date.now() - this.lastInteractionTime)/1000 > this.c_timeBeforeSessionEnded) {
               console.log("SEssio nn should end ")
               this.endSession()
          }
     }

     //add to recorded currency count
     updateCurrency(amount) {
          let newAmount = Math.floor(amount)

          this.currentGame.currency =                       Math.min(this.currentGame.currency + newAmount, MAX_CURRENCY);
          this.currentGame.totalCurrencyGeneratedPreReset = Math.min(this.currentGame.totalCurrencyGeneratedPreReset + newAmount, MAX_CURRENCY);
          
          this.fullweek.totalCurrencyGenerated =       Math.min(this.fullweek.totalCurrencyGenerated + newAmount, MAX_CURRENCY);
          this.todaysMetric().totalCurrencyGenerated = Math.min(this.todaysMetric().totalCurrencyGenerated + newAmount, MAX_CURRENCY);
     }

     //records how many generators and generators of each time i purchased
     trackGeneratorPurchase(count, index) {
          this.fullweek.totalGeneratorsPurchased       += count;
          this.todaysMetric().totalGeneratorsPurchased += count;

          this.fullweek.generatorsPurchased[index]       += count;
          this.todaysMetric().generatorsPurchased[index] += count;
     }
     
     ///save to firebase 
     saveMetrics() {
          if (this.hasLoaded === false) {
               console.error("Not loaded yet")
               return
          }
          //reset lengths if invalid
          if (this.session.lengths === undefined) { this.session.lengths = [] }
          if (this.session.activeLengths === undefined) { this.session.activeLengths = [] }
          
          //update with current states, lastTick, dayTracker, and the objects currentGame, fullweek, dailyMetrics, and session
          update(this.userRef, {
               aCurrentStatus: this.aCurrentStatus,
               currentGame: this.currentGame,

               fullweek: this.fullweek,
               dailyMetrics: this.dailyMetrics,
               session: this.session,
                    
               lastTick: Date.now(),

               dayTracker:  Array.from(this.dayTracker),
               
          }).then(() => {
               //console.log("Metrics saved successfully.");
          }).catch(error => {
               console.error("Error saving metrics:", error);
          });             
     }

     //calculate currency earned while away 
     generateOfflineEarnings(secondsAway, linearGeneratorRates, generatorRates) {
          //secondsAway = 80000
          let currentRate = generatorRates
          if (this.highCompetence === false) {
               currentRate = linearGeneratorRates
          }
          
          return this.currentGame.generatorCount.reduce((earnings, count, i) =>
               earnings + this.calculateCurrency(currentRate[i], this.currentGame.generatorCount[i])
               * Math.floor(secondsAway / 2), 0);
     }

     
     // Earn more currency based on the number of buildings owned
     calculateCurrency(rate, count) {
          // Initialize base multiplier
          let bonusMultiplier = 1;

          //apply tiered bonus multiplayer only if in high competence group
          if (this.highCompetence) {
               const thresholds = [10, 25, 50, 100, 200, 500, 1000, 5000, 10000];
               thresholds.forEach(threshold => {
                    if (count >= threshold) bonusMultiplier *= 2; // Each tier doubles production
               });
          }

          // Calculate final earnings
          return count * rate * bonusMultiplier * this.getAscensionBonus();
     }
}

