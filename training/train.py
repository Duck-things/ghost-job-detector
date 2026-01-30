# train.py - train ghost job detection model
# run: python train.py

import os
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'

import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras.layers import Dense, Dropout, BatchNormalization
from tensorflow.keras.callbacks import EarlyStopping

DATA_FILE = 'training_data.csv'
OUTPUT_DIR = 'trained_model'
EPOCHS = 100
BATCH_SIZE = 32

print('='*50)
print('GHOST JOB DETECTOR TRAINER')
print('='*50)

if not os.path.exists(DATA_FILE):
    print(f'ERROR: {DATA_FILE} not found!')
    print('Create CSV with: label,age_days,applicants,has_salary,salary_range,text_length,red_flag_count,is_staffing,is_repost,entry_high_exp,for_client,has_benefits,has_manager,competitive_salary')
    exit(1)

df = pd.read_csv(DATA_FILE)
print(f'\nLoaded {len(df)} samples')
print(f'Ghost: {len(df[df["label"]==1])}')
print(f'Real: {len(df[df["label"]==0])}')

if len(df) < 50:
    print('\nWARNING: Very few samples. Results will be poor.')
    print('Try to get at least 200 samples per class.')

X = df.drop('label', axis=1).values
y = df['label'].values

scaler = StandardScaler()
X = scaler.fit_transform(X)

os.makedirs(OUTPUT_DIR, exist_ok=True)
np.save(os.path.join(OUTPUT_DIR, 'scaler_mean.npy'), scaler.mean_)
np.save(os.path.join(OUTPUT_DIR, 'scaler_scale.npy'), scaler.scale_)

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

print(f'\nTrain: {len(X_train)}, Test: {len(X_test)}')

model = keras.Sequential([
    Dense(64, activation='relu', input_shape=(X.shape[1],)),
    BatchNormalization(),
    Dropout(0.3),
    Dense(32, activation='relu'),
    BatchNormalization(),
    Dropout(0.2),
    Dense(16, activation='relu'),
    Dense(1, activation='sigmoid')
])

model.compile(
    optimizer=keras.optimizers.Adam(learning_rate=0.001),
    loss='binary_crossentropy',
    metrics=['accuracy']
)

print(f'Model params: {model.count_params():,}')

callbacks = [EarlyStopping(monitor='val_accuracy', patience=10, restore_best_weights=True)]

print('\nTraining...')
history = model.fit(X_train, y_train, epochs=EPOCHS, batch_size=BATCH_SIZE,
                    validation_data=(X_test, y_test), callbacks=callbacks, verbose=1)

loss, acc = model.evaluate(X_test, y_test, verbose=0)
print(f'\nTest accuracy: {acc*100:.1f}%')

model.save(os.path.join(OUTPUT_DIR, 'model.keras'))
model.save(os.path.join(OUTPUT_DIR, 'model.h5'))

print(f'Saved to {OUTPUT_DIR}/')
print('Next: python convert.py')
