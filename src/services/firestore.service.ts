import { Injectable } from '@angular/core';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { from, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class FirestoreService {
  constructor(private firestore: Firestore) {}

  getDailyWatchlist(): Observable<any> {
    const docRef = doc(this.firestore, 'dailyWatchlist/today');
    return from(getDoc(docRef).then(snapshot => snapshot.data()));
  }
}

