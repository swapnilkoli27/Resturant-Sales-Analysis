import os
import pickle
import pandas as pd
import numpy as np
from datetime import datetime
from sklearn.cluster import KMeans
from sklearn.linear_model import LinearRegression
from sklearn.preprocessing import StandardScaler

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.path.join(BASE_DIR, "restaurant_sales_data.csv")
MODELS_DIR = os.path.join(BASE_DIR, "models")

def run_training_pipeline():
    print("--- GustoAnalytics MLOps Training Pipeline Started ---")
    
    # Ensure models directory exists
    os.makedirs(MODELS_DIR, exist_ok=True)
    
    # Load dataset
    if not os.path.exists(CSV_PATH):
        raise FileNotFoundError(f"Dataset not found at {CSV_PATH}. Please generate data first.")
        
    df = pd.read_csv(CSV_PATH)
    print(f"Loaded dataset: {df.shape[0]} rows of sales transactions.")

    # ---------------------------------------------
    # 1. Train Sales Forecasting Model
    # ---------------------------------------------
    print("Training Sales Forecasting Model...")
    daily = df.groupby("Date")["Total_Amount"].sum().reset_index()
    daily["Date"] = pd.to_datetime(daily["Date"])
    daily = daily.sort_values("Date")
    
    n_days = len(daily)
    daily["Trend"] = np.arange(n_days)
    daily["Is_Weekend"] = daily["Date"].dt.dayofweek.isin([4, 5, 6]).astype(int)
    
    X_forecast = daily[["Trend", "Is_Weekend"]].values
    y_forecast = daily["Total_Amount"].values
    
    forecast_model = LinearRegression()
    forecast_model.fit(X_forecast, y_forecast)
    
    # Evaluate model
    preds = forecast_model.predict(X_forecast)
    residuals = y_forecast - preds
    std_residual = np.std(residuals)
    r2_score = forecast_model.score(X_forecast, y_forecast)
    
    last_date_str = daily["Date"].max().strftime("%Y-%m-%d")
    
    forecast_bundle = {
        "model": forecast_model,
        "std_residual": float(std_residual),
        "n_days": int(n_days),
        "last_date": last_date_str,
        "r2_score": float(r2_score)
    }
    
    forecast_model_path = os.path.join(MODELS_DIR, "forecast_model.pkl")
    with open(forecast_model_path, "wb") as f:
        pickle.dump(forecast_bundle, f)
        
    print(f"Forecast Model saved. R2 Score: {r2_score:.4f}, Std Residual: {std_residual:.2f}")

    # ---------------------------------------------
    # 2. Train Customer Segmentation (K-Means) Model
    # ---------------------------------------------
    print("Training Customer Segmentation (K-Means) Model...")
    order_data = df.groupby("Order_ID").agg({
        "Total_Amount": "sum",
        "Quantity": "sum",
        "Rating": "first",
        "Time_Of_Day": "first"
    }).reset_index()
    
    time_map = {"Lunch": 0, "Snack": 1, "Dinner": 2}
    order_data["Time_Encoded"] = order_data["Time_Of_Day"].map(time_map)
    
    features = ["Total_Amount", "Quantity", "Rating", "Time_Encoded"]
    X_seg = order_data[features].values
    
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X_seg)
    
    kmeans = KMeans(n_clusters=4, random_state=42, n_init=10)
    kmeans.fit(X_scaled)
    
    order_data["Cluster"] = kmeans.labels_
    
    # Calculate deterministic personas ordered by average spend
    cluster_spend = order_data.groupby("Cluster")["Total_Amount"].mean().sort_values()
    
    persona_mapping = {
        cluster_spend.index[0]: "Quick Bite Snackers",
        cluster_spend.index[1]: "Lunch Rushers",
        cluster_spend.index[2]: "Dessert Enthusiasts",
        cluster_spend.index[3]: "The Feast Group"
    }
    
    # Pre-calculate summary stats to avoid aggregation on requests
    summary = {}
    for cluster_id, persona in persona_mapping.items():
        c_df = order_data[order_data["Cluster"] == cluster_id]
        order_ids = c_df["Order_ID"].tolist()
        items_df = df[df["Order_ID"].isin(order_ids)]
        dom_cat = items_df["Category"].mode()[0] if not items_df.empty else "N/A"
        dom_item = items_df["Item_Name"].mode()[0] if not items_df.empty else "N/A"
        
        summary[persona] = {
            "avg_spend": round(float(c_df["Total_Amount"].mean()), 2),
            "avg_quantity": round(float(c_df["Quantity"].mean()), 1),
            "avg_rating": round(float(c_df["Rating"].mean()), 2),
            "dominant_category": dom_cat,
            "dominant_item": dom_item,
            "size": int(c_df.shape[0]),
            "pct": round(float(c_df.shape[0] / order_data.shape[0] * 100), 1)
        }
        
    segmentation_bundle = {
        "kmeans": kmeans,
        "scaler": scaler,
        "persona_mapping": persona_mapping,
        "summary": summary
    }
    
    segmentation_model_path = os.path.join(MODELS_DIR, "segmentation_model.pkl")
    with open(segmentation_model_path, "wb") as f:
        pickle.dump(segmentation_bundle, f)
        
    print(f"Segmentation Model saved. Discovered {len(summary)} customer personas. Inertia: {kmeans.inertia_:.2f}")

    # ---------------------------------------------
    # 3. Optional MLflow Logging Integration
    # ---------------------------------------------
    try:
        import mlflow
        print("MLflow detected. Logging runs to experiment registry...")
        
        mlflow.set_experiment("GustoAnalytics_Restaurant_Sales")
        with mlflow.start_run():
            # Log params
            mlflow.log_param("forecast_num_days_trained", n_days)
            mlflow.log_param("kmeans_num_clusters", 4)
            
            # Log metrics
            mlflow.log_metric("forecast_r2_score", r2_score)
            mlflow.log_metric("forecast_std_residual", std_residual)
            mlflow.log_metric("kmeans_inertia", kmeans.inertia_)
            
            # Log artifacts
            mlflow.log_artifact(forecast_model_path, "models")
            mlflow.log_artifact(segmentation_model_path, "models")
            print("Successfully registered parameters, metrics, and models in MLflow run.")
    except ImportError:
        print("MLflow is not installed. Skipping remote tracking logging (local files saved).")
        
    print("--- GustoAnalytics MLOps Training Pipeline Successfully Completed ---")

if __name__ == "__main__":
    run_training_pipeline()
