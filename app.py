from flask import Flask, jsonify, render_template, request
import os
import random
import pickle
from datetime import datetime, timedelta
import pandas as pd
import numpy as np
from sklearn.cluster import KMeans
from sklearn.linear_model import LinearRegression
from sklearn.preprocessing import StandardScaler

app = Flask(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.path.join(BASE_DIR, "restaurant_sales_data.csv")

# MLOps Model Paths
FORECAST_MODEL_PATH = os.path.join(BASE_DIR, "models", "forecast_model.pkl")
SEGMENTATION_MODEL_PATH = os.path.join(BASE_DIR, "models", "segmentation_model.pkl")

forecast_bundle = None
segmentation_bundle = None

def load_models():
    global forecast_bundle, segmentation_bundle
    
    # Fail-safe: if model files do not exist, run training script
    if not os.path.exists(FORECAST_MODEL_PATH) or not os.path.exists(SEGMENTATION_MODEL_PATH):
        print("Pre-trained model binaries missing. Running train.py pipeline...")
        try:
            from train import run_training_pipeline
            run_training_pipeline()
        except Exception as e:
            print(f"Failed to auto-train models: {e}")
            
    # Load Forecast Model
    try:
        with open(FORECAST_MODEL_PATH, "rb") as f:
            forecast_bundle = pickle.load(f)
        print(f"Forecast model loaded. R2 Score: {forecast_bundle.get('r2_score', 0):.4f}")
    except Exception as e:
        print(f"Error loading forecast model binary: {e}")
        forecast_bundle = None
        
    # Load Segmentation Model
    try:
        with open(SEGMENTATION_MODEL_PATH, "rb") as f:
            segmentation_bundle = pickle.load(f)
        print("Customer segmentation K-Means model loaded.")
    except Exception as e:
        print(f"Error loading segmentation model binary: {e}")
        segmentation_bundle = None

# Bootstrapping models
load_models()

menu_items = {
    "Mains": {
        "Pizza": 12.0,
        "Burger": 8.5,
        "Pasta": 10.5,
        "Ramen": 11.0,
        "Taco": 7.0
    },
    "Appetizers": {
        "Salad": 6.0,
        "Soup": 5.0,
        "Fries": 4.0
    },
    "Desserts": {
        "Cake": 5.5,
        "Shake": 4.5,
        "Cookie": 3.0
    },
    "Beverages": {
        "Soda": 2.0,
        "Coffee": 3.5,
        "Tea": 2.5
    }
}

payment_methods = ["Cash", "Credit Card", "Mobile Wallet"]
times_of_day = ["Lunch", "Dinner", "Snack"]

def generate_sales_csv():
    os.makedirs(os.path.dirname(CSV_PATH), exist_ok=True)
    random.seed(42)
    np.random.seed(42)
    
    data = []
    base_date = datetime.now() - timedelta(days=30)
    
    txn_count = 0
    order_id_counter = 1001
    
    for i in range(250):
        order_id = f"ORD-{order_id_counter}"
        order_id_counter += 1
        
        day_offset = random.randint(0, 29)
        date_obj = base_date + timedelta(days=day_offset)
        txn_date = date_obj.strftime("%Y-%m-%d")
        
        is_weekend = date_obj.weekday() in [4, 5, 6]
        time_choice = np.random.choice(times_of_day, p=[0.35, 0.45, 0.20])
        payment = np.random.choice(payment_methods)
        
        profile = random.choice(["Feast", "Quick", "Lunch", "Dessert"])
        
        if profile == "Feast":
            num_items = random.randint(2, 4)
            rating = random.randint(4, 5)
            cat_weights = {"Mains": 0.4, "Appetizers": 0.3, "Beverages": 0.2, "Desserts": 0.1}
        elif profile == "Quick":
            num_items = 1
            rating = random.randint(3, 4)
            cat_weights = {"Beverages": 0.5, "Appetizers": 0.3, "Desserts": 0.1, "Mains": 0.1}
        elif profile == "Lunch":
            num_items = random.randint(1, 2)
            rating = random.randint(3, 5)
            cat_weights = {"Mains": 0.5, "Beverages": 0.3, "Appetizers": 0.1, "Desserts": 0.1}
        else: # Dessert
            num_items = random.randint(1, 2)
            rating = 5
            cat_weights = {"Desserts": 0.5, "Beverages": 0.3, "Mains": 0.1, "Appetizers": 0.1}
            
        categories = list(menu_items.keys())
        weights = [cat_weights[c] for c in categories]
        
        chosen_items = []
        for item_idx in range(num_items):
            category = np.random.choice(categories, p=weights)
            item = random.choice(list(menu_items[category].keys()))
            
            if item_idx > 0:
                prev_item = chosen_items[-1]["Item_Name"]
                if prev_item == "Pizza":
                    category, item = "Beverages", "Soda"
                elif prev_item == "Burger":
                    category, item = "Appetizers", "Fries"
                elif prev_item == "Cake":
                    category, item = "Beverages", "Coffee"
            
            price = menu_items[category][item]
            
            if profile == "Feast":
                qty = random.randint(2, 4)
            else:
                qty = random.randint(1, 2)
                
            if is_weekend:
                qty = min(4, qty + 1)
                
            total = round(price * qty, 2)
            
            txn_count += 1
            txn_id = f"TXN-{1000 + txn_count}"
            
            chosen_items.append({
                "Transaction_ID": txn_id,
                "Order_ID": order_id,
                "Date": txn_date,
                "Time_Of_Day": time_choice,
                "Item_Name": item,
                "Category": category,
                "Quantity": qty,
                "Unit_Price": price,
                "Total_Amount": total,
                "Payment_Method": payment,
                "Rating": rating
            })
            
        data.extend(chosen_items)
        
    df = pd.DataFrame(data)
    df.to_csv(CSV_PATH, index=False)

if os.path.exists(CSV_PATH):
    try:
        test_df = pd.read_csv(CSV_PATH)
        if "Order_ID" not in test_df.columns:
            print("Upgrading CSV database schema...")
            generate_sales_csv()
    except Exception:
        generate_sales_csv()
else:
    generate_sales_csv()

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/summary")
def get_summary():
    df = pd.read_csv(CSV_PATH)
    total_revenue = float(df["Total_Amount"].sum())
    total_txns = int(df.shape[0])
    avg_order = float(df["Total_Amount"].mean())
    avg_rating = float(df["Rating"].mean())
    
    return jsonify({
        "total_revenue": round(total_revenue, 2),
        "total_transactions": total_txns,
        "average_order_value": round(avg_order, 2),
        "average_rating": round(avg_rating, 2)
    })

@app.route("/api/charts/category")
def get_category_data():
    df = pd.read_csv(CSV_PATH)
    grouped = df.groupby("Category")["Total_Amount"].sum().reset_index()
    return jsonify(grouped.to_dict(orient="records"))

@app.route("/api/charts/daily")
def get_daily_data():
    df = pd.read_csv(CSV_PATH)
    grouped = df.groupby("Date")["Total_Amount"].sum().reset_index()
    sorted_data = grouped.sort_values("Date")
    return jsonify(sorted_data.to_dict(orient="records"))

@app.route("/api/charts/popular")
def get_popular_data():
    df = pd.read_csv(CSV_PATH)
    grouped = df.groupby("Item_Name")["Quantity"].sum().reset_index()
    sorted_data = grouped.sort_values("Quantity", ascending=False).head(5)
    return jsonify(sorted_data.to_dict(orient="records"))

@app.route("/api/transactions")
def get_transactions():
    df = pd.read_csv(CSV_PATH)
    return jsonify(df.to_dict(orient="records"))

# --- DATA SCIENCE SERVING ENDPOINTS (LOADED BINARIES) ---

@app.route("/api/ds/forecast")
def get_forecast():
    if not forecast_bundle:
        load_models()
        if not forecast_bundle:
            return jsonify({"error": "Forecast model binary not available"}), 500
            
    df = pd.read_csv(CSV_PATH)
    daily = df.groupby("Date")["Total_Amount"].sum().reset_index()
    daily["Date"] = pd.to_datetime(daily["Date"])
    daily = daily.sort_values("Date")
    
    historical = []
    for _, row in daily.iterrows():
        historical.append({
            "Date": row["Date"].strftime("%Y-%m-%d"),
            "Total_Amount": round(float(row["Total_Amount"]), 2)
        })
        
    model = forecast_bundle["model"]
    std_residual = forecast_bundle["std_residual"]
    n_days_trained = forecast_bundle["n_days"]
    last_date = datetime.strptime(forecast_bundle["last_date"], "%Y-%m-%d")
    
    forecast = []
    for i in range(1, 8):
        future_date = last_date + timedelta(days=i)
        future_trend = n_days_trained + i - 1
        future_weekend = int(future_date.weekday() in [4, 5, 6])
        
        pred_val = model.predict([[future_trend, future_weekend]])[0]
        pred_val = max(0.0, pred_val)
        
        lower = max(0.0, pred_val - 1.96 * std_residual)
        upper = pred_val + 1.96 * std_residual
        
        forecast.append({
            "Date": future_date.strftime("%Y-%m-%d"),
            "Predicted_Amount": round(float(pred_val), 2),
            "Lower_Bound": round(float(lower), 2),
            "Upper_Bound": round(float(upper), 2)
        })
        
    return jsonify({
        "historical": historical,
        "forecast": forecast
    })

@app.route("/api/ds/segmentation")
def get_segmentation():
    if not segmentation_bundle:
        load_models()
        if not segmentation_bundle:
            return jsonify({"error": "Segmentation model binary not available"}), 500
            
    df = pd.read_csv(CSV_PATH)
    
    order_data = df.groupby("Order_ID").agg({
        "Total_Amount": "sum",
        "Quantity": "sum",
        "Rating": "first",
        "Time_Of_Day": "first"
    }).reset_index()
    
    time_map = {"Lunch": 0, "Snack": 1, "Dinner": 2}
    order_data["Time_Encoded"] = order_data["Time_Of_Day"].map(time_map)
    
    features = ["Total_Amount", "Quantity", "Rating", "Time_Encoded"]
    X = order_data[features].values
    
    scaler = segmentation_bundle["scaler"]
    kmeans = segmentation_bundle["kmeans"]
    persona_mapping = segmentation_bundle["persona_mapping"]
    summary = segmentation_bundle["summary"]
    
    X_scaled = scaler.transform(X)
    order_data["Cluster"] = kmeans.predict(X_scaled)
    order_data["Persona"] = order_data["Cluster"].map(persona_mapping)
    
    scatter_points = []
    for _, row in order_data.iterrows():
        scatter_points.append({
            "x": int(row["Quantity"]),
            "y": float(row["Total_Amount"]),
            "rating": float(row["Rating"]),
            "time": row["Time_Of_Day"],
            "order_id": row["Order_ID"],
            "persona": row["Persona"],
            "cluster_id": int(row["Cluster"])
        })
        
    return jsonify({
        "points": scatter_points,
        "summary": summary
    })

@app.route("/api/ds/recommendations")
def get_recommendations():
    df = pd.read_csv(CSV_PATH)
    orders = df.groupby("Order_ID")["Item_Name"].apply(set).tolist()
    N = len(orders)
    
    if N == 0:
        return jsonify([])
        
    item_counts = df["Item_Name"].value_counts().to_dict()
    pair_counts = {}
    for basket in orders:
        basket_items = list(basket)
        for i in range(len(basket_items)):
            for j in range(i + 1, len(basket_items)):
                item_a, item_b = basket_items[i], basket_items[j]
                pair = tuple(sorted([item_a, item_b]))
                pair_counts[pair] = pair_counts.get(pair, 0) + 1
                
    recommendations = []
    for pair, count in pair_counts.items():
        item_a, item_b = pair
        support = count / N
        conf_a_b = count / item_counts[item_a]
        conf_b_a = count / item_counts[item_b]
        lift = support / ((item_counts[item_a] / N) * (item_counts[item_b] / N))
        
        recommendations.append({
            "item_a": item_a,
            "item_b": item_b,
            "co_occurrences": count,
            "support": round(support * 100, 1),
            "confidence_a_to_b": round(conf_a_b * 100, 1),
            "confidence_b_to_a": round(conf_b_a * 100, 1),
            "lift": round(lift, 2)
        })
        
    recommendations = sorted(recommendations, key=lambda x: x["co_occurrences"], reverse=True)[:5]
    
    for r in recommendations:
        item_a, item_b = r["item_a"], r["item_b"]
        if (item_a == "Pizza" and item_b == "Soda") or (item_a == "Soda" and item_b == "Pizza"):
            r["suggestion"] = "Pizza & Soda Combo: High purchase correlation. Add a 'Meal Deal' for a 10% discount to upsell."
        elif (item_a == "Burger" and item_b == "Fries") or (item_a == "Fries" and item_b == "Burger"):
            r["suggestion"] = "Burger & Fries Bundle: Perfect side-pairing. Prompt customers to add fries at checkout."
        elif (item_a == "Cake" and item_b == "Coffee") or (item_a == "Coffee" and item_b == "Cake"):
            r["suggestion"] = "Afternoon Sweet Treat: Promote Cake + Coffee combos during Snack times (2 PM - 5 PM)."
        else:
            r["suggestion"] = f"Cross-Sell Alert: Customers frequently purchase {item_a} and {item_b} together. Consider bundle packaging."
            
    return jsonify(recommendations)

@app.route("/api/ds/menu_optimizer")
def get_menu_optimizer():
    df = pd.read_csv(CSV_PATH)
    
    item_stats = df.groupby("Item_Name").agg({
        "Quantity": "sum",
        "Total_Amount": "sum",
        "Rating": "mean",
        "Category": "first",
        "Unit_Price": "first"
    }).reset_index()
    
    median_qty = item_stats["Quantity"].median()
    median_rev = item_stats["Total_Amount"].median()
    
    menu_data = []
    for _, row in item_stats.iterrows():
        qty = int(row["Quantity"])
        rev = float(row["Total_Amount"])
        
        if qty >= median_qty and rev >= median_rev:
            quadrant = "Star"
            strategy = "Prominent placement. Keep quality high."
        elif qty < median_qty and rev >= median_rev:
            quadrant = "Cash Cow"
            strategy = "Premium margin. Promote to boost volume."
        elif qty >= median_qty and rev < median_rev:
            quadrant = "Volume Driver"
            strategy = "Popular but low margin. Consider small price increase."
        else:
            quadrant = "Underperformer"
            strategy = "Low sales & margin. Redesign or bundle with high-performers."
            
        menu_data.append({
            "item_name": row["Item_Name"],
            "category": row["Category"],
            "unit_price": float(row["Unit_Price"]),
            "quantity_sold": qty,
            "total_revenue": round(rev, 2),
            "avg_rating": round(float(row["Rating"]), 2),
            "quadrant": quadrant,
            "strategy": strategy
        })
        
    return jsonify({
        "items": menu_data,
        "median_quantity": float(median_qty),
        "median_revenue": float(median_rev)
    })

@app.route("/api/ds/simulate", methods=["GET", "POST"])
def simulate():
    if request.method == "POST":
        params = request.get_json() or {}
    else:
        params = request.args
        
    price_adjust_pizza = float(params.get("adjust_pizza", 0.0))
    price_adjust_burger = float(params.get("adjust_burger", 0.0))
    price_adjust_pasta = float(params.get("adjust_pasta", 0.0))
    price_adjust_ramen = float(params.get("adjust_ramen", 0.0))
    
    rating_modifier = float(params.get("rating_modifier", 0.0))
    dinner_volume_shift = float(params.get("dinner_volume_shift", 0.0))
    
    df = pd.read_csv(CSV_PATH)
    
    baseline_revenue = float(df["Total_Amount"].sum())
    baseline_rating = float(df["Rating"].mean())
    
    sim_df = df.copy()
    
    price_shifts = {
        "Pizza": price_adjust_pizza,
        "Burger": price_adjust_burger,
        "Pasta": price_adjust_pasta,
        "Ramen": price_adjust_ramen
    }
    
    for item, shift in price_shifts.items():
        if shift != 0.0:
            item_mask = sim_df["Item_Name"] == item
            sim_df.loc[item_mask, "Unit_Price"] = sim_df.loc[item_mask, "Unit_Price"] + shift
            sim_df.loc[item_mask, "Total_Amount"] = sim_df.loc[item_mask, "Quantity"] * sim_df.loc[item_mask, "Unit_Price"]
            
    if dinner_volume_shift != 0.0:
        dinner_mask = sim_df["Time_Of_Day"] == "Dinner"
        sim_df.loc[dinner_mask, "Total_Amount"] = sim_df.loc[dinner_mask, "Total_Amount"] * (1.0 + dinner_volume_shift)
        
    if rating_modifier != 0.0:
        sim_df["Rating"] = (sim_df["Rating"] + rating_modifier).clip(1.0, 5.0)
        
    sim_revenue = float(sim_df["Total_Amount"].sum())
    sim_rating = float(sim_df["Rating"].mean())
    
    revenue_change_pct = ((sim_revenue - baseline_revenue) / baseline_revenue) * 100
    
    return jsonify({
        "baseline_revenue": round(baseline_revenue, 2),
        "simulated_revenue": round(sim_revenue, 2),
        "revenue_change_pct": round(revenue_change_pct, 2),
        "baseline_rating": round(baseline_rating, 2),
        "simulated_rating": round(sim_rating, 2),
        "rating_change": round(sim_rating - baseline_rating, 2)
    })

if __name__ == "__main__":
    app.run(debug=True, host="127.0.0.1", port=5002)
