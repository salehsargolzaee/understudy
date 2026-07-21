def column_means(df):
    return {col: df[col].mean() for col in df.columns}
