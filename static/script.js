document.addEventListener("DOMContentLoaded", () => {
    // State management
    let transactions = [];
    let baselineSummary = null;
    let activeTab = "overview-tab";
    
    // Chart instances
    let dailyChart = null;
    let categoryChart = null;
    let popularChart = null;
    let forecastChart = null;
    let scatterChart = null;
    let bubbleChart = null;
    
    // DOM Elements
    const searchInput = document.getElementById("search-input");
    const transactionRows = document.getElementById("transaction-rows");
    
    // Tab definitions with header texts
    const tabHeaders = {
        "overview-tab": {
            title: "Restaurant Sales Portal",
            subtitle: "Core Business Analytics and Sales Operations"
        },
        "forecast-tab": {
            title: "Predictive Sales Forecasting",
            subtitle: "7-Day Revenue Projections with Linear Regression Modeling"
        },
        "segmentation-tab": {
            title: "Customer Segmentation Analytics",
            subtitle: "Order Persona Grouping via K-Means Clustering"
        },
        "optimizer-tab": {
            title: "Menu & Product Optimization",
            subtitle: "BCG Quadrant Matrix & Market Basket Co-occurrences"
        },
        "simulator-tab": {
            title: "What-If Business Simulator",
            subtitle: "Interactive Pricing, Marketing, and Quality Forecasting"
        }
    };

    // Initialize Page Clock
    function updateClock() {
        const now = new Date();
        const hrs = String(now.getHours()).padStart(2, '0');
        const mins = String(now.getMinutes()).padStart(2, '0');
        const clockEl = document.getElementById("clock");
        if (clockEl) clockEl.textContent = `${hrs}:${mins}`;
    }
    setInterval(updateClock, 1000);
    updateClock();

    // 1. Tab switching navigation
    const navItems = document.querySelectorAll(".nav-item");
    navItems.forEach(item => {
        item.addEventListener("click", (e) => {
            e.preventDefault();
            const tabId = item.getAttribute("data-tab");
            switchTab(tabId);
        });
    });

    function switchTab(tabId) {
        activeTab = tabId;
        
        // Update nav active status
        navItems.forEach(nav => {
            if (nav.getAttribute("data-tab") === tabId) {
                nav.classList.add("active");
            } else {
                nav.classList.remove("active");
            }
        });
        
        // Show/hide tab panels
        const tabPanes = document.querySelectorAll(".tab-pane");
        tabPanes.forEach(pane => {
            if (pane.id === tabId) {
                pane.classList.add("active");
            } else {
                pane.classList.remove("active");
            }
        });
        
        // Update headers
        const headerInfo = tabHeaders[tabId];
        document.getElementById("page-title-display").textContent = headerInfo.title;
        document.getElementById("page-subtitle-display").textContent = headerInfo.subtitle;
        
        // Resize and load charts for active tab
        loadTabSpecificData(tabId);
    }

    // 2. Load KPIs and Core Data
    async function loadCoreDashboard() {
        try {
            // Load base KPIs
            const summaryRes = await fetch("/api/summary");
            baselineSummary = await summaryRes.json();
            updateKPIs(baselineSummary);
            
            // Set simulator baselines
            updateSimulatorBaselines(baselineSummary);

            // Load transaction logs
            const txnsRes = await fetch("/api/transactions");
            transactions = await txnsRes.json();
            renderTable(transactions);

            // Load default tab
            loadTabSpecificData(activeTab);
        } catch (error) {
            console.error("Error loading GustoAnalytics base dashboard:", error);
        }
    }

    function updateKPIs(summary) {
        document.getElementById("metric-revenue").textContent = `$${summary.total_revenue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
        document.getElementById("metric-orders").textContent = summary.total_transactions.toLocaleString();
        document.getElementById("metric-avg-check").textContent = `$${summary.average_order_value.toFixed(2)}`;
        document.getElementById("metric-rating").textContent = `${summary.average_rating.toFixed(2)} / 5.0`;
    }

    function renderTable(list) {
        transactionRows.innerHTML = "";
        list.forEach(t => {
            const row = document.createElement("tr");
            
            // Classify payment method tags
            let payTag = "tag-cash";
            if (t.Payment_Method === "Credit Card") payTag = "tag-card";
            else if (t.Payment_Method === "Mobile Wallet") payTag = "tag-wallet";
            
            row.innerHTML = `
                <td class="txn-id">${t.Transaction_ID}</td>
                <td>${t.Date}</td>
                <td>${t.Time_Of_Day}</td>
                <td><strong>${t.Item_Name}</strong></td>
                <td>${t.Category}</td>
                <td>${t.Quantity}</td>
                <td>$${t.Total_Amount.toFixed(2)}</td>
                <td><span class="badge-tag ${payTag}">${t.Payment_Method}</span></td>
            `;
            transactionRows.appendChild(row);
        });
    }

    function filterTable() {
        const query = searchInput.value.toLowerCase();
        const filtered = transactions.filter(t => {
            return t.Item_Name.toLowerCase().includes(query) || 
                   t.Category.toLowerCase().includes(query) ||
                   t.Transaction_ID.toLowerCase().includes(query);
        });
        renderTable(filtered);
    }
    searchInput.addEventListener("input", filterTable);

    // 3. Tab Specific Data Loading
    function loadTabSpecificData(tabId) {
        if (tabId === "overview-tab") {
            drawOverviewCharts();
        } else if (tabId === "forecast-tab") {
            loadForecastData();
        } else if (tabId === "segmentation-tab") {
            loadSegmentationData();
        } else if (tabId === "optimizer-tab") {
            loadOptimizerData();
        } else if (tabId === "simulator-tab") {
            // Already initialized, trigger standard simulation run
            runSimulation();
        }
    }

    // --- OVERVIEW CHARTS ---
    async function drawOverviewCharts() {
        try {
            // Daily Sales
            const dailyRes = await fetch("/api/charts/daily");
            const dailyData = await dailyRes.json();
            drawDailyChart(dailyData);

            // Category Share
            const catRes = await fetch("/api/charts/category");
            const catData = await catRes.json();
            drawCategoryChart(catData);

            // Popular Items
            const popRes = await fetch("/api/charts/popular");
            const popData = await popRes.json();
            drawPopularChart(popData);
        } catch (e) {
            console.error("Error drawing overview charts:", e);
        }
    }

    function drawDailyChart(data) {
        const categories = data.map(d => d.Date);
        const revenues = data.map(d => d.Total_Amount);

        const options = {
            series: [{ name: "Daily Revenue", data: revenues }],
            chart: {
                type: "area",
                height: 280,
                background: "transparent",
                toolbar: { show: false }
            },
            colors: ["#FF9F00"],
            stroke: { curve: "smooth", width: 3 },
            fill: {
                type: "gradient",
                gradient: {
                    shadeIntensity: 1,
                    opacityFrom: 0.4,
                    opacityTo: 0.02
                }
            },
            grid: { borderColor: "rgba(255, 255, 255, 0.05)" },
            xaxis: {
                categories: categories,
                labels: { style: { colors: "#64748B" } },
                axisBorder: { show: false },
                axisTicks: { show: false }
            },
            yaxis: {
                labels: { style: { colors: "#64748B" } }
            },
            tooltip: { theme: "dark" }
        };

        if (dailyChart) dailyChart.destroy();
        dailyChart = new ApexCharts(document.querySelector("#daily-sales-chart"), options);
        dailyChart.render();
    }

    function drawCategoryChart(data) {
        const labels = data.map(d => d.Category);
        const series = data.map(d => d.Total_Amount);

        const options = {
            series: series,
            labels: labels,
            chart: {
                type: "donut",
                height: 280,
                background: "transparent"
            },
            colors: ["#FF9F00", "#00F2FF", "#10B981", "#8B5CF6"],
            legend: {
                position: "bottom",
                labels: { colors: "#94A3B8" }
            },
            stroke: { show: false },
            tooltip: { theme: "dark" },
            plotOptions: {
                pie: {
                    donut: {
                        size: "70%",
                        labels: {
                            show: true,
                            name: { show: true, color: "#64748B" },
                            value: { show: true, color: "#FFF" },
                            total: {
                                show: true,
                                color: "#FF9F00",
                                label: "Revenue",
                                formatter: function(w) {
                                    return "$" + Math.round(w.globals.seriesTotals.reduce((a, b) => a + b, 0)).toLocaleString();
                                }
                            }
                        }
                    }
                }
            }
        };

        if (categoryChart) categoryChart.destroy();
        categoryChart = new ApexCharts(document.querySelector("#category-chart"), options);
        categoryChart.render();
    }

    function drawPopularChart(data) {
        const items = data.map(d => d.Item_Name);
        const quantities = data.map(d => d.Quantity);

        const options = {
            series: [{ name: "Quantity Sold", data: quantities }],
            chart: {
                type: "bar",
                height: 280,
                background: "transparent",
                toolbar: { show: false }
            },
            plotOptions: {
                bar: {
                    horizontal: true,
                    barHeight: "50%",
                    borderRadius: 4
                }
            },
            colors: ["#00F2FF"],
            grid: { borderColor: "rgba(255, 255, 255, 0.05)" },
            xaxis: {
                categories: items,
                labels: { style: { colors: "#64748B" } }
            },
            yaxis: {
                labels: { style: { colors: "#64748B" } }
            },
            tooltip: { theme: "dark" }
        };

        if (popularChart) popularChart.destroy();
        popularChart = new ApexCharts(document.querySelector("#popular-items-chart"), options);
        popularChart.render();
    }

    // --- FORECASTING ---
    async function loadForecastData() {
        try {
            const res = await fetch("/api/ds/forecast");
            const data = await res.json();
            
            // Calculate projections sum for KPIs
            const totalProjected = data.forecast.reduce((sum, item) => sum + item.Predicted_Amount, 0);
            document.getElementById("forecast-projected-revenue").textContent = `$${totalProjected.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
            
            // Show trajectory percentage
            const histSum = data.historical.slice(-7).reduce((sum, item) => sum + item.Total_Amount, 0);
            const rate = ((totalProjected - histSum) / histSum) * 100;
            const trajEl = document.getElementById("forecast-trend-trajectory");
            if (rate >= 0) {
                trajEl.style.color = "var(--color-green)";
                trajEl.textContent = `Ascending (+${rate.toFixed(1)}%)`;
            } else {
                trajEl.style.color = "var(--color-red)";
                trajEl.textContent = `Descending (${rate.toFixed(1)}%)`;
            }

            // Draw forecast chart
            drawForecastChart(data);
        } catch (e) {
            console.error("Error loading forecast data:", e);
        }
    }

    function drawForecastChart(data) {
        // Construct single time series for ApexCharts
        // We will have three lines: Historical, Forecast, Upper Bounds, Lower Bounds
        const categories = [];
        const histSeries = [];
        const foreSeries = [];
        const upperSeries = [];
        const lowerSeries = [];
        
        // Add historical
        data.historical.forEach(h => {
            categories.push(h.Date);
            histSeries.push(h.Total_Amount);
            foreSeries.push(null);
            upperSeries.push(null);
            lowerSeries.push(null);
        });
        
        // Add a connector point for smooth transition
        const lastHistIdx = data.historical.length - 1;
        const lastHist = data.historical[lastHistIdx];
        
        // Forecast starts at last day of historical
        foreSeries[lastHistIdx] = lastHist.Total_Amount;
        upperSeries[lastHistIdx] = lastHist.Total_Amount;
        lowerSeries[lastHistIdx] = lastHist.Total_Amount;
        
        // Add forecast
        data.forecast.forEach(f => {
            categories.push(f.Date);
            histSeries.push(null);
            foreSeries.push(f.Predicted_Amount);
            upperSeries.push(f.Upper_Bound);
            lowerSeries.push(f.Lower_Bound);
        });

        const options = {
            series: [
                { name: "Historical Sales", data: histSeries },
                { name: "7-Day Sales Forecast", data: foreSeries },
                { name: "Confidence Upper Limit", data: upperSeries },
                { name: "Confidence Lower Limit", data: lowerSeries }
            ],
            chart: {
                type: "line",
                height: 380,
                background: "transparent",
                toolbar: { show: false }
            },
            colors: ["#FF9F00", "#10B981", "#00F2FF", "#00F2FF"],
            stroke: {
                width: [3, 3, 1, 1],
                dashArray: [0, 5, 3, 3],
                curve: "smooth"
            },
            grid: { borderColor: "rgba(255, 255, 255, 0.05)" },
            xaxis: {
                categories: categories,
                labels: { style: { colors: "#64748B" } }
            },
            yaxis: {
                labels: { style: { colors: "#64748B" } }
            },
            legend: {
                labels: { colors: "#94A3B8" }
            },
            tooltip: { theme: "dark" }
        };

        if (forecastChart) forecastChart.destroy();
        forecastChart = new ApexCharts(document.querySelector("#forecast-chart-container"), options);
        forecastChart.render();
    }

    // --- CUSTOMER CLUSTERS ---
    async function loadSegmentationData() {
        try {
            const res = await fetch("/api/ds/segmentation");
            const data = await res.json();

            // Populate persona cards
            const container = document.getElementById("cluster-personas-list");
            container.innerHTML = "";
            
            // Deterministic order: Quick Bite, Lunch Rushers, Dessert Enthusiasts, The Feast Group
            const orderedPersonas = [
                "Quick Bite Snackers",
                "Lunch Rushers",
                "Dessert Enthusiasts",
                "The Feast Group"
            ];
            
            orderedPersonas.forEach((personaName, idx) => {
                const info = data.summary[personaName];
                if (!info) return;

                const card = document.createElement("div");
                card.className = "cluster-profile-card";
                card.innerHTML = `
                    <div class="cluster-header">
                        <span class="cluster-name">${personaName}</span>
                        <span class="cluster-badge badge-c${idx}">${info.pct}% of orders</span>
                    </div>
                    <div class="cluster-stats">
                        <div>Avg spend: <strong>$${info.avg_spend.toFixed(2)}</strong></div>
                        <div>Avg basket size: <strong>${info.avg_quantity} items</strong></div>
                        <div>Avg rating: <strong>${info.avg_rating.toFixed(1)}★</strong></div>
                    </div>
                    <div style="font-size: 0.75rem; color: #64748B;">
                        Dominant Category: <strong style="color: #E2E8F0;">${info.dominant_category}</strong> | 
                        Top Item: <strong style="color: #E2E8F0;">${info.dominant_item}</strong>
                    </div>
                `;
                container.appendChild(card);
            });

            // Draw Scatter plot
            drawSegmentationScatter(data, orderedPersonas);
        } catch (e) {
            console.error("Error loading segmentation data:", e);
        }
    }

    function drawSegmentationScatter(data, orderedPersonas) {
        // Group points by persona
        const series = orderedPersonas.map((pName, idx) => {
            const pts = data.points.filter(pt => pt.persona === pName);
            return {
                name: pName,
                data: pts.map(pt => [pt.x, pt.y])
            };
        });

        const options = {
            series: series,
            chart: {
                type: "scatter",
                height: 380,
                background: "transparent",
                toolbar: { show: false }
            },
            colors: ["#00F2FF", "#10B981", "#8B5CF6", "#FF9F00"],
            xaxis: {
                title: { text: "Items Ordered (Quantity)", style: { color: "#94A3B8" } },
                labels: { style: { colors: "#64748B" } },
                tickAmount: 5
            },
            yaxis: {
                title: { text: "Order Spend Amount ($)", style: { color: "#94A3B8" } },
                labels: { style: { colors: "#64748B" } }
            },
            grid: { borderColor: "rgba(255, 255, 255, 0.05)" },
            legend: {
                labels: { colors: "#94A3B8" }
            },
            tooltip: {
                theme: "dark",
                custom: function({series, seriesIndex, dataPointIndex, w}) {
                    const xVal = w.config.series[seriesIndex].data[dataPointIndex][0];
                    const yVal = w.config.series[seriesIndex].data[dataPointIndex][1];
                    const persona = w.config.series[seriesIndex].name;
                    return '<div style="padding: 10px; background: #0B0E14; border: 1px solid rgba(255,255,255,0.1); border-radius: 6px;">' +
                        '<span style="color: #FF9F00; font-weight: bold;">' + persona + '</span><br/>' +
                        '<span style="color: #FFF;">Items Count: ' + xVal + '</span><br/>' +
                        '<span style="color: #FFF;">Order Spend: $' + yVal.toFixed(2) + '</span>' +
                        '</div>';
                }
            }
        };

        if (scatterChart) scatterChart.destroy();
        scatterChart = new ApexCharts(document.querySelector("#segmentation-scatter-chart"), options);
        scatterChart.render();
    }

    // --- MENU OPTIMIZER & BASKET ANALYSIS ---
    async function loadOptimizerData() {
        try {
            // Load BCG Quadrant matrix
            const optRes = await fetch("/api/ds/menu_optimizer");
            const optData = await optRes.json();
            
            // Populate Optimizer Table
            const tbody = document.getElementById("optimizer-rows");
            tbody.innerHTML = "";
            
            optData.items.forEach(item => {
                const tr = document.createElement("tr");
                
                // Color codes for BCG status
                let badgeClass = "quadrant-under";
                if (item.quadrant === "Star") badgeClass = "quadrant-star";
                else if (item.quadrant === "Cash Cow") badgeClass = "quadrant-cow";
                else if (item.quadrant === "Volume Driver") badgeClass = "quadrant-volume";
                
                tr.innerHTML = `
                    <td><strong>${item.item_name}</strong></td>
                    <td>${item.category}</td>
                    <td>$${item.unit_price.toFixed(2)}</td>
                    <td>${item.quantity_sold}</td>
                    <td>$${item.total_revenue.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    <td>${item.avg_rating.toFixed(1)}★</td>
                    <td><span class="${badgeClass}">${item.quadrant}</span></td>
                    <td style="color: #94A3B8; font-size: 0.8rem;">${item.strategy}</td>
                `;
                tbody.appendChild(tr);
            });

            // Draw bubble chart
            drawOptimizerBubble(optData);

            // Load Basket recommendations
            const recRes = await fetch("/api/ds/recommendations");
            const recData = await recRes.json();
            renderRecommendations(recData);
        } catch (e) {
            console.error("Error loading optimizer data:", e);
        }
    }

    function drawOptimizerBubble(optData) {
        // Group menu items by category
        const categories = [...new Set(optData.items.map(i => i.category))];
        const series = categories.map(cat => {
            const items = optData.items.filter(i => i.category === cat);
            return {
                name: cat,
                data: items.map(i => ({
                    x: i.quantity_sold,
                    y: i.total_revenue,
                    z: i.avg_rating * 5, // scale size by rating
                    item_name: i.item_name
                }))
            };
        });

        const options = {
            series: series,
            chart: {
                type: "bubble",
                height: 280,
                background: "transparent",
                toolbar: { show: false }
            },
            colors: ["#FF9F00", "#00F2FF", "#10B981", "#8B5CF6"],
            xaxis: {
                title: { text: "Sales Volume (Quantity Sold)", style: { color: "#94A3B8" } },
                labels: { style: { colors: "#64748B" } }
            },
            yaxis: {
                title: { text: "Total Revenue Generated ($)", style: { color: "#94A3B8" } },
                labels: { style: { colors: "#64748B" } }
            },
            grid: { borderColor: "rgba(255, 255, 255, 0.05)" },
            legend: {
                labels: { colors: "#94A3B8" }
            },
            tooltip: {
                theme: "dark",
                custom: function({series, seriesIndex, dataPointIndex, w}) {
                    const item = w.config.series[seriesIndex].data[dataPointIndex];
                    return '<div style="padding: 10px; background: #0B0E14; border: 1px solid rgba(255,255,255,0.1); border-radius: 6px;">' +
                        '<span style="color: #FF9F00; font-weight: bold;">' + item.item_name + '</span><br/>' +
                        '<span style="color: #FFF;">Qty Sold: ' + item.x + '</span><br/>' +
                        '<span style="color: #FFF;">Revenue: $' + item.y.toFixed(2) + '</span><br/>' +
                        '<span style="color: #FFF;">Avg Rating: ' + (item.z / 5).toFixed(1) + '★</span>' +
                        '</div>';
                }
            }
        };

        if (bubbleChart) bubbleChart.destroy();
        bubbleChart = new ApexCharts(document.querySelector("#optimizer-bubble-chart"), options);
        bubbleChart.render();
    }

    function renderRecommendations(recs) {
        const container = document.getElementById("recommendations-list");
        container.innerHTML = "";
        
        recs.forEach(r => {
            const card = document.createElement("div");
            card.className = "recommendation-card";
            card.innerHTML = `
                <div class="rec-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                    </svg>
                </div>
                <div class="rec-details">
                    <div class="rec-title">${r.item_a} & ${r.item_b}</div>
                    <div class="rec-body">${r.suggestion}</div>
                    <div class="rec-metrics">
                        <span>Support: <strong>${r.support}%</strong></span>
                        <span>Confidence: <strong>${r.confidence_a_to_b}%</strong></span>
                        <span>Lift: <strong>${r.lift}x</strong></span>
                    </div>
                </div>
            `;
            container.appendChild(card);
        });
    }

    // --- WHAT-IF SIMULATOR ---
    const sliders = {
        pizza: document.getElementById("slider-pizza"),
        burger: document.getElementById("slider-burger"),
        pasta: document.getElementById("slider-pasta"),
        ramen: document.getElementById("slider-ramen"),
        dinner: document.getElementById("slider-dinner"),
        rating: document.getElementById("slider-rating")
    };

    const valDisplays = {
        pizza: document.getElementById("pizza-val"),
        burger: document.getElementById("burger-val"),
        pasta: document.getElementById("pasta-val"),
        ramen: document.getElementById("ramen-val"),
        dinner: document.getElementById("dinner-val"),
        rating: document.getElementById("rating-val")
    };

    // Bind slider input changes
    Object.keys(sliders).forEach(key => {
        sliders[key].addEventListener("input", () => {
            updateSliderDisplay(key);
            debouncedRunSimulation();
        });
    });

    function updateSliderDisplay(key) {
        const val = parseFloat(sliders[key].value);
        if (key === "dinner") {
            const prefix = val > 0 ? "+" : "";
            valDisplays[key].textContent = `${prefix}${val}%`;
        } else if (key === "rating") {
            valDisplays[key].textContent = `+${val.toFixed(1)}`;
        } else {
            const prefix = val >= 0 ? "+" : "-";
            valDisplays[key].textContent = `${prefix}$${Math.abs(val).toFixed(2)}`;
        }
    }

    function updateSimulatorBaselines(summary) {
        document.getElementById("sim-revenue-before").textContent = `$${summary.total_revenue.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
        document.getElementById("sim-rating-before").textContent = `${summary.average_rating.toFixed(2)} / 5.0`;
    }

    // Debounce simulation runs to prevent flooding APIs
    let simTimeout = null;
    function debouncedRunSimulation() {
        if (simTimeout) clearTimeout(simTimeout);
        simTimeout = setTimeout(runSimulation, 250);
    }

    async function runSimulation() {
        const params = {
            adjust_pizza: parseFloat(sliders.pizza.value),
            adjust_burger: parseFloat(sliders.burger.value),
            adjust_pasta: parseFloat(sliders.pasta.value),
            adjust_ramen: parseFloat(sliders.ramen.value),
            dinner_volume_shift: parseFloat(sliders.dinner.value) / 100.0,
            rating_modifier: parseFloat(sliders.rating.value)
        };

        try {
            const res = await fetch("/api/ds/simulate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(params)
            });
            const data = await res.json();
            
            // Update UI Outcomes
            document.getElementById("sim-revenue-after").textContent = `$${data.simulated_revenue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
            document.getElementById("sim-rating-after").textContent = `${data.simulated_rating.toFixed(2)} / 5.0`;
            
            // Revenue Badge
            const revBadge = document.getElementById("sim-revenue-change-badge");
            const revChange = data.revenue_change_pct;
            revBadge.className = "sim-change-badge";
            if (revChange > 0) {
                revBadge.classList.add("positive");
                revBadge.textContent = `+${revChange.toFixed(2)}% Impact`;
            } else if (revChange < 0) {
                revBadge.classList.add("negative");
                revBadge.textContent = `${revChange.toFixed(2)}% Impact`;
            } else {
                revBadge.classList.add("neutral");
                revBadge.textContent = `+0.00% Impact`;
            }

            // Rating Badge
            const ratBadge = document.getElementById("sim-rating-change-badge");
            const ratChange = data.rating_change;
            ratBadge.className = "sim-change-badge";
            if (ratChange > 0) {
                ratBadge.classList.add("positive");
                ratBadge.textContent = `+${ratChange.toFixed(2)} Rating`;
            } else if (ratChange < 0) {
                ratBadge.classList.add("negative");
                ratBadge.textContent = `${ratChange.toFixed(2)} Rating`;
            } else {
                ratBadge.classList.add("neutral");
                ratBadge.textContent = `+0.00 Rating`;
            }

        } catch (e) {
            console.error("Error executing simulation:", e);
        }
    }

    // Reset Simulation
    document.getElementById("reset-sim-btn").addEventListener("click", () => {
        Object.keys(sliders).forEach(key => {
            sliders[key].value = 0;
            updateSliderDisplay(key);
        });
        runSimulation();
    });

    // Initialize displays on start
    Object.keys(sliders).forEach(updateSliderDisplay);

    // Bootstrap app
    loadCoreDashboard();
});
