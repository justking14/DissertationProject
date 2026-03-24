import { auth } from "./firebaseConfig.js";
import { signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.21.0/firebase-auth.js";
import MetricHandler from "./MetricHandler.js";

const emailForm = document.getElementById("emailForm");
let metricHandler = null;

//submit user id to retrieve data from firebase 
emailForm.addEventListener('submit', async (e) => {
     e.preventDefault();

     //show loading message
     document.getElementById('center-text').style.display = "flex"

     const email = document.getElementById('email').value + "@rpi.edu";
     try {
          //try to sign in 
          await signInAnonymously(auth);
          console.log('User signed in anonymously.');
          const sanitizedEmail = email.toLowerCase().replace(/[^a-z0-9@_-]/g, '').replace(/\./g, '_');

          metricHandler = new MetricHandler(sanitizedEmail, highCompetence, highAutonomy);

          //check for prolonged inaction and save every 15 seconds
          setInterval(() => metricHandler.checkInteractionTime(), 30000);
          setInterval(() => metricHandler.saveMetrics(), 15000);

          emailForm.hidden = true;
          loadGame();
     } catch (error) {
          console.error('Error:', error.message);
          alert('An error occurred. Check the console for details.');
     }
});

//different generator output based on group
let generatorRates = [1, 8, 47, 260, 1400, 7800, 44000, 260000, 1600000, 10000000, 65000000, 430000000, 2900000000, 21000000000 ];
//let linearGeneratorRates = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
let linearGeneratorRates = [1, 1.5, 2.5, 4, 6, 9, 13,18, 24, 31, 39, 48, 58, 69];

//let linearGeneratorRates = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5];

let NUMBERofGENERATORS = 14

let highCompetence = true;
let highAutonomy = true;

let progress = Array.from({ length: NUMBERofGENERATORS }, () => Math.random());

console.log(progress)
let midAscension = false;

let lastLeaveTime = null; // Tracks when the player left
let returnHandled = false; // Ensures only one event handles the return

let offlineTextTimer = null;

let dailySurvey = document.getElementById("dailySurvey");
let exitSurvey =  document.getElementById("exitSurvey");


function handleBlur() {
     if (!metricHandler || lastLeaveTime) return;
     handleLeaving("blur")
}
function handleFocus() {
     if (!metricHandler || !lastLeaveTime || returnHandled) return; // Prevent duplicate processing
     handleReturning("focus")
}
function visibilityChangeHandler() {
     if (!metricHandler) return;

     if (document.visibilityState === "hidden") {
          if (!lastLeaveTime) {
               handleLeaving("hidden")
          }
     } else if (document.visibilityState === "visible" && lastLeaveTime && !returnHandled) {
          handleReturning("visibility")
     }
}
function handleLeaving(type) {
     lastLeaveTime = Date.now();
     returnHandled = false; // Allow return processing
     console.log("Player left the game: ", type);

     metricHandler.aCurrentStatus = "unfocused"

     metricHandler.endSession();
     metricHandler.saveMetrics();
}
function handleReturning(type) {
     returnHandled = true; // Mark return as handled immediately
     let timeAway = (Date.now() - lastLeaveTime) / 1000;
     console.log(`Player was away for ${timeAway.toFixed(2)} seconds (via ${type}).`);

     //timeAway = 80000
     let offlineEarnings = metricHandler.generateOfflineEarnings(timeAway, linearGeneratorRates, generatorRates);
     if (offlineEarnings > 0) {
          metricHandler.updateCurrency(offlineEarnings);

          document.getElementById('offlineText').style.color = "Black"
          document.getElementById('offlineText').hidden = false

          document.getElementById('offlineText').innerText =
               `While you were away for ${formatTime(timeAway)}, you earned ${formatNumbers(offlineEarnings)} currency!`;
          
          clearInterval(offlineTextTimer)
          offlineTextTimer = setTimeout(() => {
               document.getElementById('offlineText').hidden = true
          }, 10000)
     }

     lastLeaveTime = null;

     metricHandler.aCurrentStatus = "focused"
     metricHandler.focusStartTime = Date.now();

     if (!metricHandler.sessionActive) metricHandler.startSession();
}

//on loading game
window.onload = () => {
     //checks for when leaving/returning to game to end/start session
     document.addEventListener('visibilitychange', visibilityChangeHandler);
     window.addEventListener('blur', handleBlur); 
     window.addEventListener('focus', handleFocus);

     //currency button
     document.getElementById('currencyButton').onpointerdown = clickForCurrency
    
     //build generator
     for (let i = 1; i <= NUMBERofGENERATORS; i++) {
          document.getElementById(`buyGen${i}`).onclick = function (event) {
               event.stopPropagation(); // Prevent parent interference
               event.preventDefault();  // Ensure click is registered

               let rect = document.getElementById(`buyGen${i}`).getBoundingClientRect();
               let x = rect.left + rect.width / 2 + window.scrollX;
               let y = rect.top + rect.height / 2 + window.scrollY;
               createParticles(x, y, i - 1);     
               metricHandler.buyGenerator(i - 1);
          };
          document.getElementById(`buyMaxGen${i}`).onclick = function () {
               let maxCount = metricHandler.buyMaxGenerators(i - 1);
               //console.log(maxCount)
               let rect = document.getElementById(`buyMaxGen${i}`).getBoundingClientRect();
               let x = rect.left + rect.width / 2 + window.scrollX;
               let y = rect.top + rect.height / 2 + window.scrollY;

               for (let j = 0; j < Math.min(14, maxCount); j++){
                    createParticles(x, y, i - 1);     
               }
          };
     }

     //ascend button 
     document.getElementById('ascendButton').onclick = ascend
};
function clickForCurrency(event) {
     event.preventDefault();
     event.stopPropagation();
     if (metricHandler) {
          metricHandler.clickForCurrency(linearGeneratorRates, generatorRates)
     }
}

function createParticles(x, y, generatorIndex) {
     let numParticles = Math.min(15 + generatorIndex * 2, 50); // More particles for later generators
     let spread = 100 + generatorIndex * 10; // Bigger spread radius
     let colors = [buttonStyles[generatorIndex].bg, buttonStyles[generatorIndex].secondary, buttonStyles[generatorIndex].tertiary];

     for (let i = 0; i < numParticles; i++) {
          let particle = document.createElement("div");
          particle.classList.add("particle");
          document.body.appendChild(particle);

          let size = Math.random() * (generatorIndex * 2) + 5; // Increase particle size slightly
          particle.style.width = `${size}px`;
          particle.style.height = `${size}px`;

          // Some particles have gradient backgrounds for later generators
          if (generatorIndex > 5 && Math.random() > 0.5) {
               particle.style.background = `linear-gradient(45deg, ${colors[0]}, ${colors[1]})`;
          } else {
               particle.style.background = colors[Math.floor(Math.random() * colors.length)];
          }

          particle.style.left = `${x}px`;
          particle.style.top = `${y}px`;

          let angle = Math.random() * 2 * Math.PI; // Random direction
          let distance = Math.random() * spread;
          let moveX = Math.cos(angle) * distance;
          let moveY = Math.sin(angle) * distance;

          let rotation = Math.random() * 360;
          let scale = Math.random() * 1.5 + 0.5; // Random scaling

          // Different shapes for later generators
          if (generatorIndex > 6) {
               let shapes = ["50%", "0%", "10%"]; // Circle, Square, Rounded Square
               particle.style.borderRadius = shapes[Math.floor(Math.random() * shapes.length)];
          }

          // Add a glowing effect for higher-numbered generators
          if (generatorIndex > 8) {
               particle.style.boxShadow = `0 0 ${5 + generatorIndex * 2}px ${colors[1]}`;
          }

          // **Only apply pulsing glow for later generators**
          if (generatorIndex > 10) {
               let pulseDuration = (0.1 + Math.random() * 0.1).toFixed(2); // Random pulse between 0.4s and 1s
               particle.style.animation = `pulseGlow ${pulseDuration}s infinite alternate ease-in-out`;
          }

          if (generatorIndex > 12) {
               particle.style.background = `linear-gradient(45deg, ${getRandomColor()}, ${getRandomColor()})`;
          }

          // Delay transition for animation effect
          requestAnimationFrame(() => {
               particle.style.transition = `
                    transform ${0.8 + generatorIndex * 0.1}s ease-out, 
                    opacity ${1.0 + generatorIndex * 0.01}s linear
               `;
               if (generatorIndex > 10) {
                    scale *= (Math.random() * 1.5)
                    //particle.style.animation = `flicker ${2.3 + Math.random() * 0.2}s ease-in-out infinite alternate`;
               }
               particle.style.transform = `translate(${moveX}px, ${moveY}px) rotate(${rotation}deg) scale(${scale})`;
               particle.style.opacity = "0"; // Smooth fade-out
          });

          setTimeout(() => particle.remove(), 900 + generatorIndex * 50);
     }
}

//before game is unloaded/closed, end the current session and save
window.onbeforeunload = function () {
     console.log("UNLOADING ")
     //end session and save before closing tab 
     metricHandler.endSession();
     metricHandler.saveMetrics();
}

window.addEventListener("load", () => {
     document.getElementById("clickSound").load();
     document.getElementById("buySound").load();
     document.getElementById("buyMaxSound").load();
     document.getElementById("ascSound").load();
     document.getElementById("buzzSound").load();
});

//create generators and make buttons red if low autonomy 
document.addEventListener("DOMContentLoaded", () => {
     //build generator divs
     createGenerators()

     //only proceed if low autonomy
     if (highAutonomy === true) { return }

     //get buttons that can be turned red, those visible and not disabled
     function getVisibleButtons() {
          return Array.from(document.querySelectorAll("button")).filter(btn =>
               !btn.hidden && btn.offsetParent !== null && !btn.disabled && btn.id !== "submit"
          );
     }

     let currencyText = document.getElementById("currency");
     let warningDiv = document.getElementById("warning");
     let redButton = null; //currently selected button 
     let storedClickHandler = null; //functions attached to red
     let isButtonRed = false; //is button currently red or is it breaktime?
     let wasRecentlyPunished = false;//keep warning from triggering repeatedly
     let redButtonColor = null;

     //turn a button red for 5 seconds, then wait another 5, then turn a button red for 5 seconds
     function turnButtonRed() {
          console.log("Turning button red...");

          // Reset previous red button and give it back its function
          if (redButton) {
               redButton.style.backgroundColor = "";
               redButton.style.background = redButtonColor;
               redButton.onclick = storedClickHandler; // Restore original function
               redButton = null;
               currencyText.style.color = "#45a049";
          }
          const buttons = getVisibleButtons();

          //if no usable buttons, try again in 5 seconds
          if (buttons.length < 2) { setTimeout(turnButtonRed, 1000); return; }
          
          //swap back and forth every 5 seconds
          isButtonRed = !isButtonRed

          ///if its time to turn red, pick a random button and turn it red
          if (isButtonRed === true) {
               // Select a new button
               redButton = buttons[Math.floor(Math.random() * buttons.length)];
               redButtonColor = redButton.style.background
               redButton.style.backgroundColor = "red";
               redButton.style.background = "red";

               // Store and disable the button's original function
               storedClickHandler = redButton.onclick;
               redButton.onclick = punishPlayer;
          }

          //repeat in 5 seconds
          setTimeout(turnButtonRed, 1000 + (Math.random() * 3000));
     }

     function punishPlayer() {
          //keeps punishment from triggering repeatedly
          if (wasRecentlyPunished) return;
          wasRecentlyPunished = true;

          //show warning
          warningDiv.hidden = false;
          warningDiv.disabled = false;

          //play buzzer
          playSound("buzzSound")

          //cut currency in half and turn button red
          if (metricHandler && metricHandler.currentGame) {
               let oldCurrency = metricHandler.currentGame.currency;
               metricHandler.currentGame.currency = Math.max(1, Math.floor(metricHandler.currentGame.currency * 0.75));
               currencyText.style.color = "Red";

               document.getElementById('offlineText').style.color = "Red"
               document.getElementById('offlineText').hidden = false
               document.getElementById('offlineText').innerText =
                    `You lost ${formatNumbers(oldCurrency - metricHandler.currentGame.currency)} units of currency!`;
               clearInterval(offlineTextTimer)
               offlineTextTimer = setTimeout(() => {
                    document.getElementById('offlineText').hidden = true
               }, 10000)
          }

          //hide warning and allow punishment after 1 second 
          setTimeout(() => {
               warningDiv.hidden = true;
               warningDiv.disabled = true;
               wasRecentlyPunished = false;
          }, 1000);
     }

     //kick start process
     turnButtonRed();
});

//creates div elements for each buy button, max buy button, and progress bars
function createGenerators() {
     const container = document.getElementById("generators-container");
     for (let i = 1; i <= NUMBERofGENERATORS; i++) {
          const generatorDiv = document.createElement("div");
          generatorDiv.className = "generator";
          generatorDiv.innerHTML = `
            <button id="buyGen${i}" type="button"><span>Buy Generator ${i} (Cost: ${10 ** i})</span></button>
            <button id="buyMaxGen${i}" type="button"><span id="spanText">Buy Max (0) - Cost: 0</span></button>
            <div class="progress-container" id="progressContainer${i - 1}">
                <div class="progress-bar" id="progressBar${i - 1}">
                    <div id="progress${i - 1}" class="progress-fill"></div>
                </div>
            </div>
        `;
          generatorDiv.hidden = true;
          generatorDiv.disabled = true;
          container.appendChild(generatorDiv);

          let genButton = document.getElementById("buyGen" + i)
          let maxGenButton = document.getElementById("buyMaxGen" + i)

          if (i > 10) {
               genButton.style.backgroundSize = "400% 100%"; // Keeps the gradient continuous
               maxGenButton.style.backgroundSize = "400% 100%";

               if (i === 11) {
                    genButton.classList.add("green-gradient");
                    maxGenButton.classList.add("green-gradient")
               }else if (i === 12) {
                    genButton.classList.add("blue-gradient");
                    maxGenButton.classList.add("blue-gradient");
               } else if (i === 13) {
                    genButton.classList.add("black-gradient");
                    maxGenButton.classList.add("black-gradient");
               } else if (i > 13) {
                    genButton.classList.add("rainbow-gradient");
                    maxGenButton.classList.add("rainbow-gradient");
               }
               
          } else {
               genButton.style.background = buttonStyles[i - 1].bg;
               maxGenButton.style.background = buttonStyles[i - 1].bg;
          }

          genButton.style.color = buttonStyles[i - 1].color;
          genButton.style.boxShadow = buttonStyles[i - 1].shadow;
          genButton.style.border = buttonStyles[i - 1].border;

          maxGenButton.style.color = buttonStyles[i - 1].color;
          maxGenButton.style.boxShadow = buttonStyles[i - 1].shadow;
          maxGenButton.style.border = buttonStyles[i - 1].border;

          document.getElementById(`progress${i - 1}`).style.background = `linear-gradient(90deg, ${buttonStyles[i - 1].bg}, ${buttonStyles[i - 1].secondary}, ${buttonStyles[i - 1].tertiary})`

     }
     // script.js (Modified for Stylized Buttons)

}

function showFloatingText(index, amount) {
    const progressBar = document.getElementById(`progressBar${index}`);
    if (!progressBar) return;

    const floatingText = document.createElement('div');
    floatingText.className = 'floating-text';

    let formattedAmount = formatNumbers(amount);

    const minFontSize = 1;
    const maxFontSize = progressBar.offsetWidth / 8;
    let fntSize = Math.max(minFontSize, Math.min(maxFontSize, Math.log10(amount) * 0.6));
    floatingText.style.fontSize = `${fntSize}em`; 
    floatingText.style.color = interpolateColor(amount, 0.1, 100000000000);
    floatingText.innerText = formattedAmount;

    // Append floating text but keep it hidden initially
    floatingText.style.visibility = "hidden";
     progressBar.parentElement.appendChild(floatingText);
     
    floatingText.addEventListener("animationend", () => {
        floatingText.style.animation = "none"; // Stop animation once it finishes
    });

    setTimeout(() => {
        const progressBarWidth = progressBar.offsetWidth;
        let floatingTextWidth = floatingText.offsetWidth;

        // **Adjust Font Size if Too Wide**
        if (floatingTextWidth > progressBarWidth) {
            fntSize *= progressBarWidth / floatingTextWidth;
            floatingText.style.fontSize = `${fntSize}em`;
        }

        // **Recalculate Floating Text Width after Font Resize**
        floatingTextWidth = floatingText.offsetWidth;

        // **Center text dynamically relative to the progress bar**
        const progressBarRect = progressBar.getBoundingClientRect();
        const parentRect = progressBar.parentElement.getBoundingClientRect();
        floatingText.style.position = "absolute";
        floatingText.style.left = `${progressBarRect.left - parentRect.left + (progressBarWidth / 2) - (floatingTextWidth / 2)}px`;

        floatingText.style.visibility = "visible";
    }, 10);
     
     setTimeout(() => {
          if (floatingText.parentElement) {
               floatingText.parentElement.removeChild(floatingText);
          }
     }, 1400); // Matches animation duration


    //setTimeout(() => floatingText.remove(), 1500);
}


//Perform ascension
function ascend() {
     //keep ascension from being mashed repeatedly
     if (midAscension) return;
     midAscension = true;

     playSound("ascSound");

     //spin everything
     const elements = document.querySelectorAll('h1, div, button');
     elements.forEach(element => {
          const xVal = getRandomValue(-1000, 1000, 500);
          const yVal = getRandomValue(-1000, 1000, 500);
          const rotation = Math.random() * 720;

          element.style.willChange = 'transform';
          element.style.transition = 'transform 1.5s ease-in-out';
          element.style.transform = `translate(${xVal}px, ${yVal}px) rotate(${rotation}deg)`;
     });

     // Restore elements after animation ends
     setTimeout(() => {
          midAscension = false;
          progress = new Array(NUMBERofGENERATORS).fill(Math.random());
          elements.forEach(element => { element.style.transform = ''; });

          metricHandler.handleAscension();
     }, 1500);
}

//load game and recall old metrics
function loadGame() {
     metricHandler.loadMetrics();

     function waitForSessionToLoad() {
          if (metricHandler.hasLoaded) {
               console.log("has finished loading, proceeding with offline earnings calculation.");

               metricHandler.startSession();

               //change survey based on experimental condition
               var surveyLink = document.getElementById('dailySurvey');
               if (highCompetence === false && highAutonomy === true) {
                    surveyLink.href = "https://forms.gle/YPjazdMFKU4EBMq28"
               } else if (highCompetence === true && highAutonomy === false) {
                    surveyLink.href = "https://forms.gle/hn9aR3L2nSaPs2U3A"
               } else if (highCompetence === false && highAutonomy === false) {
                    surveyLink.href = "https://forms.gle/M6kocBxAjvfWBdjq8"
               }
               //disable link after clicking on it
               surveyLink.onclick = disableLink;

               var exitSurveyLink = document.getElementById('exitSurvey');
               if (highCompetence === false && highAutonomy === true) {
                    exitSurveyLink.href = "https://forms.gle/QmxaysUJKvM1r7Kh8"
               } else if (highCompetence === true && highAutonomy === false) {
                    exitSurveyLink.href = "https://forms.gle/fdFB9zPbRMb8xhhE9"
               } else if (highCompetence === false && highAutonomy === false) {
                    exitSurveyLink.href = "https://forms.gle/JjCYLVXEFwjqfiNR7"
               }
               //disable link after clicking on it
               exitSurveyLink.onclick = disableExitLink;

               //calculate offline earning upon returning to the game and print the output
               setTimeout(() => {
                    let timeAway = (Date.now() - metricHandler.lastTick) / 1000;
                    console.log(" loading game time away", timeAway)
                    let offlineEarnings = metricHandler.generateOfflineEarnings(timeAway, linearGeneratorRates, generatorRates);
                    if (offlineEarnings > 0) {
                         metricHandler.updateCurrency(offlineEarnings);

                         document.getElementById('offlineText').style.color = "Black"
                         document.getElementById('offlineText').hidden = false

                         document.getElementById('offlineText').innerText =
                              `While you were away for ${formatTime(timeAway)}, you earned ${formatNumbers(offlineEarnings)} currency!`;

                         clearInterval(offlineTextTimer)
                         offlineTextTimer = setTimeout(() => {
                              document.getElementById('offlineText').hidden = true
                         }, 10000)
                    }
               }, 5);

               setInterval(passiveGeneration, 100);
          } else {
               console.log("game has not loaded yet, retrying in 1 second...");
               setTimeout(waitForSessionToLoad, 1000); // Check again in 1 second
          }
     }
     waitForSessionToLoad()
}
//disable link if clicked today
function disableLink() {
     if(!metricHandler){return}
     metricHandler.todaysMetric().linkClickedToday = true
     metricHandler.fullweek.numberOfLinksClicked += 1
}
function disableExitLink() {
     if (!metricHandler) {return}
     metricHandler.fullweek.exitSurveyClicked = 1
}

//progress progression bars every 0.1 seconds
function passiveGeneration() {
     //don't generate currency if game has not been loaded or is not in focus
     if (!metricHandler) return;
     if (!metricHandler.hasLoaded) return;
     if (metricHandler.aCurrentStatus === "unfocused") return;
     //console.log(metricHandler.aCurrentStatus)

     //console.log((Date.now() - metricHandler.focusStartTime) / 1000)
     //add 1/10 of a second to total runtime every call
     metricHandler.fullweek.gameRuntime += 0.1

     //check if daily metric exists
     const today = new Date().toDateString();
     if (!metricHandler.dailyMetrics[today]) { metricHandler.createDailyMetric(today) }
     
     //add to the days runtime
     if (metricHandler.dailyMetrics[today] ) {
          metricHandler.dailyMetrics[today].gameRuntime += 0.1;
          //shows/hides survey

          if (metricHandler.focusStartTime !== null) {
               let focusDuration = metricHandler.dailyMetrics[today].focusTime + Math.floor((Date.now() - metricHandler.focusStartTime) / 1000)

               //console.log(metricHandler.dailyMetrics[today].gameRuntime, focusDuration)
               //console.log(metricHandler.dailyMetrics[today].gameRuntime, metricHandler.dailyMetrics[today].linkClickedToday)
               if (metricHandler.dailyMetrics[today].linkClickedToday === true) {
                    dailySurvey.style.display = "none"
               } else if (focusDuration > 180) {
                    dailySurvey.style.display = "inline-block"
               }

               if (metricHandler.fullweek.numberOfLinksClicked >= 3 && metricHandler.fullweek.exitSurveyClicked === 0) {
                    exitSurvey.style.display = "inline-block"
               } else {
                    exitSurvey.style.display = "none"
               }
          }
     }

     metricHandler.checkForNullUndefined(metricHandler.fullweek)
     metricHandler.checkForNullUndefined(metricHandler.currentGame)
     metricHandler.checkForNullUndefined(metricHandler.session)
     metricHandler.checkForNullUndefined(metricHandler.dailyMetrics)

     //change generator rate based on experimental condition
     let currentRate = generatorRates
     if (highCompetence === false) {
          currentRate = linearGeneratorRates
     }

     //for each generator, add to progress bar and print generated currency 
     metricHandler.currentGame.generatorCount.forEach((count, i) => {
          if (count > 0) {
               progress[i] += 0.05;
               const progressBar = document.getElementById(`progress${i}`);

               if (progress[i] >= 1.05) {
                    let amountGenerated = metricHandler.calculateCurrency(currentRate[i], count)
                    metricHandler.updateCurrency(amountGenerated);
                    showFloatingText(i, amountGenerated);

                    // Smooth transition to full
                    progressBar.style.transition = 'width 0.3s ease-out';
                    progress[i] = -0.05;
               } else {
                    // Smooth filling animation
                    progressBar.style.transition = 'width 0.1s linear';
                    progressBar.style.width = `${progress[i] * 100}%`;
               }
          }
     });
}

//update div elements
let frameCounter = 0;
function updateDisplay() {
     if (!metricHandler) { requestAnimationFrame(updateDisplay); return }
     
     //only update 6 times per second
     frameCounter++;
     if (frameCounter % 10 !== 0) { requestAnimationFrame(updateDisplay); return }

     //divide by 2 since it needs at least 
     const cps = metricHandler.generateOfflineEarnings(2, linearGeneratorRates, generatorRates) / 2;
     const formattedCps = Number.isInteger(cps) ? formatLargeNumbers(cps) : cps.toFixed(2).toLocaleString('en', { useGrouping: true });

     document.getElementById('currency').innerText =
          `Currency: ${formatNumbers(Math.floor(metricHandler.currentGame.currency))}
          ${formatNumbers(cps)}/s

     `;
     document.getElementById('currencyButton').querySelector("span").textContent = `Click for ${formatNumbers(metricHandler.clickForCurrencyAmount(linearGeneratorRates, generatorRates))} Unit(s) of Currency`;

     updateGenerators()
     updateAscensionButton()
               
     requestAnimationFrame(updateDisplay);
}

function updateGenerators() {
     
     //update each generator div element
     metricHandler.currentGame.generatorCount.forEach((count, i) => {
          const buyButton = document.getElementById(`buyGen${i + 1}`);
          const maxBuyButton = document.getElementById(`buyMaxGen${i + 1}`);
          const progressContainer = document.getElementById(`progressContainer${i}`);

          //change cost based on experimental conditions
          if (highCompetence) {
               buyButton.querySelector("span").textContent = `Buy Generator ${i + 1} (Count: ${count} Cost: ${formatNumbers(metricHandler.currentGame.generatorCosts[i])})`;
          } else {
               buyButton.querySelector("span").textContent = `Buy Generator ${i + 1} (Count: ${count} Cost: ${formatNumbers(metricHandler.currentGame.linearGeneratorCosts[i])})`;
          }

          ///how many can i buy?
          let [maxCanBuy, totalCost] = metricHandler.calculateMaxCountAndCost(i)
          maxBuyButton.querySelector("span").textContent = `Buy Max (${maxCanBuy}): Cost: ${formatNumbers(totalCost)}`;

          progressContainer.style.display = count > 0 ? 'flex' : 'none';

          //disable button if you can't afford to buy 1
          if (highCompetence) {
               buyButton.disabled = metricHandler.currentGame.currency < metricHandler.currentGame.generatorCosts[i];
          } else {
               buyButton.disabled = metricHandler.currentGame.currency < metricHandler.currentGame.linearGeneratorCosts[i];
          }

          //hide and disable nax button if you can buy 1 or less
          maxBuyButton.disabled = maxCanBuy <= 1;
          maxBuyButton.hidden = maxCanBuy <= 1;

          //never hide first generator
          if (i !== 0) {
               //hide 2nd on if none of the one before have been purchased 
               if (metricHandler.currentGame.generatorCount[i - 1] == 0) {
                    buyButton.hidden = true;
                    maxBuyButton.hidden = true
               } else {
                    buyButton.hidden = false;
               }
          }
     });
}

function updateAscensionButton() {
     const ascButton = document.getElementById('ascendButton');

     let [prestigePointsGivenOnReset, percentage_increase, progressToNextPrestige] = metricHandler.ascensionCalculator()

     let prestigeProgressText = `Ascend for ${formatLargeNumbers(prestigePointsGivenOnReset)} 
                                   Prestige Point(s) \n (+${formatLargeNumbers(Math.floor(percentage_increase))}% Production Boost) \n
                                   Progress to Next Prestige Point: ${progressToNextPrestige.toFixed(2)}%`;
     //if an ascension can't be performed yet
     if(prestigePointsGivenOnReset <= metricHandler.currentGame.ascensionScore){
          prestigeProgressText = `Progress to next Prestige: ${progressToNextPrestige.toFixed(2)}%`;
     }

     ascButton.querySelector("span").textContent = prestigeProgressText

     ascButton.disabled = prestigePointsGivenOnReset <= metricHandler.currentGame.ascensionScore || midAscension;
}

requestAnimationFrame(updateDisplay);
