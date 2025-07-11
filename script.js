// --- DOM elements ---
// Make sure secrets.js defines the API key like this:
// window.OPENAI_API_KEY = "your-api-key-here";
// This allows all your code files to access the key as window.OPENAI_API_KEY
const randomBtn = document.getElementById("random-btn");
const recipeDisplay = document.getElementById("recipe-display");

// Get both sets of remix controls (top and bottom)
const remixBtnTop = document.getElementById("remix-btn");
const remixThemeTop = document.getElementById("remix-theme");

// If you want a second set of controls at the bottom, give them unique IDs in your HTML, e.g.:
// <select id="remix-theme-bottom">...</select>
// <button id="remix-btn-bottom">Remix</button>
const remixBtnBottom = document.getElementById("remix-btn-bottom");
const remixThemeBottom = document.getElementById("remix-theme-bottom");

// Helper to get the selected theme from the correct control
function getSelectedTheme(source) {
  if (source === "top" && remixThemeTop) return remixThemeTop.value;
  if (source === "bottom" && remixThemeBottom) return remixThemeBottom.value;
  // fallback to top if only one exists
  return remixThemeTop ? remixThemeTop.value : "";
}

// This function creates a list of ingredients for the recipe from the API data
// It loops through the ingredients and measures, up to 20, and returns an HTML string
// that can be used to display them in a list format
// If an ingredient is empty or just whitespace, it skips that item 
function getIngredientsHtml(recipe) {
  let html = "";
  for (let i = 1; i <= 20; i++) {
    const ing = recipe[`strIngredient${i}`];
    const meas = recipe[`strMeasure${i}`];
    if (ing && ing.trim()) html += `<li>${meas ? `${meas} ` : ""}${ing}</li>`;
  }
  return html;
}

// This function displays the recipe on the page (original recipe)
function renderRecipe(recipe) {
  recipeDisplay.innerHTML = `
    <div class="recipe-title-row">
      <h2>${recipe.strMeal}</h2>
    </div>
    <img src="${recipe.strMealThumb}" alt="${recipe.strMeal}" />
    <h3>Ingredients:</h3>
    <ul>${getIngredientsHtml(recipe)}</ul>
    <h3>Instructions:</h3>
    <p>${recipe.strInstructions.replace(/\r?\n/g, "<br>")}</p>
    <button id="save-recipe-btn" class="save-inline-btn">Save Recipe</button>
  `;
  // Add event listener for Save button
  const saveBtn = document.getElementById("save-recipe-btn");
  if (saveBtn) {
    saveBtn.addEventListener("click", saveCurrentRecipe);
  }
}

// Save the current recipe name to localStorage
function saveCurrentRecipe() {
  if (!currentRecipe || !currentRecipe.strMeal) return;
  let saved = JSON.parse(localStorage.getItem("savedRecipes") || "[]");
  if (!saved.includes(currentRecipe.strMeal)) {
    saved.push(currentRecipe.strMeal);
    localStorage.setItem("savedRecipes", JSON.stringify(saved));
    renderSavedRecipes();
  }
}

// Render the saved recipes list above the main recipe display
function renderSavedRecipes() {
  const container = document.getElementById("saved-recipes-container");
  const list = document.getElementById("saved-recipes-list");
  let saved = JSON.parse(localStorage.getItem("savedRecipes") || "[]");
  if (saved.length === 0) {
    container.style.display = "none";
    list.innerHTML = "";
    return;
  }
  container.style.display = "block";
  list.innerHTML = saved.map(name => `
    <li class="saved-recipe-item">
      <span class="saved-recipe-link" data-name="${encodeURIComponent(name)}" tabindex="0">${name}</span>
      <button class="delete-btn" data-name="${encodeURIComponent(name)}">Delete</button>
    </li>
  `).join("");
  // Add event listeners for delete buttons
  const deleteBtns = list.querySelectorAll(".delete-btn");
  deleteBtns.forEach(btn => {
    btn.addEventListener("click", function() {
      const name = decodeURIComponent(this.getAttribute("data-name"));
      deleteSavedRecipe(name);
    });
  });
  // Add event listeners for recipe name clicks
  const recipeLinks = list.querySelectorAll(".saved-recipe-link");
  recipeLinks.forEach(link => {
    link.addEventListener("click", function() {
      const name = decodeURIComponent(this.getAttribute("data-name"));
      fetchAndDisplayRecipeByName(name);
    });
    // Also allow keyboard accessibility
    link.addEventListener("keydown", function(e) {
      if (e.key === "Enter" || e.key === " ") {
        const name = decodeURIComponent(this.getAttribute("data-name"));
        fetchAndDisplayRecipeByName(name);
      }
    });
  });
}

// Fetch a recipe by name from MealDB and display it
async function fetchAndDisplayRecipeByName(name) {
  recipeDisplay.innerHTML = "<p>Loading recipe...</p>";
  try {
    const res = await fetch(`https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(name)}`);
    const data = await res.json();
    if (data.meals && data.meals.length > 0) {
      currentRecipe = data.meals[0];
      renderRecipe(currentRecipe);
    } else {
      recipeDisplay.innerHTML = `<p>Recipe not found.</p>`;
    }
  } catch (error) {
    recipeDisplay.innerHTML = `<p>Sorry, couldn't load the recipe.</p>`;
  }
}

// Delete a saved recipe by name
function deleteSavedRecipe(name) {
  let saved = JSON.parse(localStorage.getItem("savedRecipes") || "[]");
  saved = saved.filter(n => n !== name);
  localStorage.setItem("savedRecipes", JSON.stringify(saved));
  renderSavedRecipes();
}

// This function gets a random recipe from the API and shows it
let currentRecipe = null; // Store the current recipe for remixing
async function fetchAndDisplayRandomRecipe() {
  recipeDisplay.innerHTML = "<p>Loading...</p>"; // Show loading message
  try {
    // Fetch a random recipe from the MealDB API
    const res = await fetch('https://www.themealdb.com/api/json/v1/1/random.php');
    const data = await res.json(); // Parse the JSON response
    const recipe = data.meals[0]; // Get the first recipe from the response
    currentRecipe = recipe; // Save for remixing
    renderRecipe(recipe); // Render the recipe on the page
  } catch (error) {
    recipeDisplay.innerHTML = "<p>Sorry, couldn't load a recipe.</p>";
  }
}

// --- Remix function ---
// This function sends the current recipe and selected theme to OpenAI and displays the remixed recipe
async function remixRecipe(themeSource = "top") {
  // Show a fun loading message in the remix-output box (below the Remix button)
  const remixOutput = document.getElementById("remix-output");
  if (remixOutput) {
    remixOutput.innerHTML = `<p>Remixing your recipe... The AI chef is cooking up something special!</p>`;
  }
  try {
    // Get the OpenAI API key from secrets.js
    const apiKey = window.OPENAI_API_KEY;
    if (!apiKey) {
      if (remixOutput) remixOutput.innerHTML = `<p>OpenAI API key not found. Please add it to secrets.js.</p>`;
      return;
    }
    if (!currentRecipe) {
      if (remixOutput) remixOutput.innerHTML = `<p>No recipe to remix! Try getting a random recipe first.</p>`;
      return;
    }
    // Get the selected theme from the correct control
    const theme = getSelectedTheme(themeSource);
    // Prepare the prompt for the AI
    const prompt = `Remix this recipe with the theme: "${theme}". Be short, fun, creative, and totally doable. Highlight any changed ingredients or instructions.\n\nRecipe JSON:\n${JSON.stringify(currentRecipe, null, 2)}`;
    // Call OpenAI's chat completions API
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4.1",
        messages: [
          { role: "system", content: "You are a creative chef who loves remixing recipes in fun, doable ways." },
          { role: "user", content: prompt }
        ],
        max_tokens: 500,
        temperature: 0.9
      })
    });
    if (!response.ok) throw new Error("OpenAI API error");
    const data = await response.json();
    const aiText = data.choices[0].message.content;
    // Display the remixed recipe in the remix-output box, with a Save button
    if (remixOutput) {
      remixOutput.innerHTML = `<h2>Remixed Recipe</h2><pre style="white-space: pre-wrap;">${aiText}</pre>\n<button id="save-remix-btn" class="save-inline-btn">Save Remixed Recipe</button>`;
      // Add event listener for Save Remixed Recipe button
      const saveRemixBtn = document.getElementById("save-remix-btn");
      if (saveRemixBtn) {
        saveRemixBtn.addEventListener("click", function() {
          saveRemixedRecipe(aiText);
        });
      }
    }
    // Store the latest remixed recipe text for saving
    window._latestRemixText = aiText;
    renderSavedRemixes();
  } catch (error) {
    if (remixOutput) {
      remixOutput.innerHTML = `<p>Sorry, something went wrong with the remix. Please try again!</p>`;
    }
  }
}

// Save the remixed recipe to localStorage
function saveRemixedRecipe(remixText) {
  let saved = JSON.parse(localStorage.getItem("savedRemixes") || "[]");
  if (!saved.includes(remixText)) {
    saved.push(remixText);
    localStorage.setItem("savedRemixes", JSON.stringify(saved));
    renderSavedRemixes();
  }
}

// Render the saved remixed recipes below the remix box
function renderSavedRemixes() {
  let saved = JSON.parse(localStorage.getItem("savedRemixes") || "[]");
  let remixList = document.getElementById("saved-remixes-list");
  let remixContainer = document.getElementById("saved-remixes-container");
  if (!remixList) {
    // Create the container and list if not present
    remixContainer = document.createElement("div");
    remixContainer.id = "saved-remixes-container";
    remixContainer.innerHTML = `<h3>Saved Remixed Recipes</h3><ul id="saved-remixes-list"></ul>`;
    // Insert after the remix box
    const remixBox = document.getElementById("remix-output");
    if (remixBox && remixBox.parentNode) {
      remixBox.parentNode.appendChild(remixContainer);
    }
    remixList = document.getElementById("saved-remixes-list");
  }
  if (saved.length === 0) {
    remixContainer.style.display = "none";
    remixList.innerHTML = "";
    return;
  }
  remixContainer.style.display = "block";
  remixList.innerHTML = saved.map((text, i) => `
    <li class="saved-recipe-item">
      <span class="saved-remix-link" data-index="${i}" tabindex="0">Remixed Recipe #${i + 1}</span>
      <button class="delete-btn" data-index="${i}">Delete</button>
    </li>
  `).join("");
  // Add event listeners for delete buttons
  const deleteBtns = remixList.querySelectorAll(".delete-btn");
  deleteBtns.forEach(btn => {
    btn.addEventListener("click", function() {
      const idx = parseInt(this.getAttribute("data-index"));
      deleteSavedRemix(idx);
    });
  });
  // Add event listeners for remix name clicks (show the remix in the remix-output box)
  const remixLinks = remixList.querySelectorAll(".saved-remix-link");
  remixLinks.forEach(link => {
    link.addEventListener("click", function() {
      const idx = parseInt(this.getAttribute("data-index"));
      showSavedRemix(idx);
    });
    link.addEventListener("keydown", function(e) {
      if (e.key === "Enter" || e.key === " ") {
        const idx = parseInt(this.getAttribute("data-index"));
        showSavedRemix(idx);
      }
    });
  });
}

// Delete a saved remixed recipe by index
function deleteSavedRemix(idx) {
  let saved = JSON.parse(localStorage.getItem("savedRemixes") || "[]");
  saved.splice(idx, 1);
  localStorage.setItem("savedRemixes", JSON.stringify(saved));
  renderSavedRemixes();
}

// Show a saved remixed recipe in the remix-output box
function showSavedRemix(idx) {
  let saved = JSON.parse(localStorage.getItem("savedRemixes") || "[]");
  const remixOutput = document.getElementById("remix-output");
  if (remixOutput && saved[idx]) {
    remixOutput.innerHTML = `<h2>Remixed Recipe</h2><pre style="white-space: pre-wrap;">${saved[idx]}</pre>`;
  }
}


// --- Event listeners ---

// When the button is clicked, get and show a new random recipe
randomBtn.addEventListener("click", fetchAndDisplayRandomRecipe);

// When the Remix button at the top is clicked, remix the current recipe
if (remixBtnTop) {
  remixBtnTop.addEventListener("click", function() { remixRecipe("top"); });
}
// When the Remix button at the bottom is clicked, remix the current recipe
if (remixBtnBottom) {
  remixBtnBottom.addEventListener("click", function() { remixRecipe("bottom"); });
}

// When the page (DOM content) loads, show a random recipe and load saved recipes and remixes
document.addEventListener("DOMContentLoaded", function() {
  fetchAndDisplayRandomRecipe();
  renderSavedRecipes();
  renderSavedRemixes();
});