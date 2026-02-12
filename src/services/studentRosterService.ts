// Student Roster Service - Firebase CRUD operations for student rosters

import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
  Timestamp,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { StudentRoster } from '@/types/scanning';

const ROSTERS_COLLECTION = 'studentRosters';
const STUDENTS_COLLECTION = 'students';

export class StudentRosterService {
  /**
   * Create a new roster for an exam
   */
  static async createRoster(
    examId: string,
    studentIds: string[],
    userId: string
  ): Promise<{ success: boolean; data?: StudentRoster; error?: string }> {
    try {
      const rosterId = `roster_${examId}_${Date.now()}`;
      const now = new Date().toISOString();

      const rosterData: StudentRoster = {
        id: rosterId,
        examId,
        studentIds: [...new Set(studentIds)], // Remove duplicates
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
      };

      await setDoc(doc(db, ROSTERS_COLLECTION, rosterId), {
        ...rosterData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      return { success: true, data: rosterData };
    } catch (error) {
      console.error('Error creating roster:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Get roster by exam ID
   */
  static async getRosterByExamId(
    examId: string
  ): Promise<{ success: boolean; data?: StudentRoster; error?: string }> {
    try {
      const q = query(
        collection(db, ROSTERS_COLLECTION),
        where('examId', '==', examId)
      );

      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        return { success: false, error: 'Roster not found' };
      }

      const docData = querySnapshot.docs[0].data();
      const roster: StudentRoster = {
        ...docData,
        createdAt: (docData.createdAt as Timestamp)?.toDate().toISOString() || '',
        updatedAt: (docData.updatedAt as Timestamp)?.toDate().toISOString() || '',
      } as StudentRoster;

      return { success: true, data: roster };
    } catch (error) {
      console.error('Error fetching roster:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Add student ID to roster
   */
  static async addStudentToRoster(
    rosterId: string,
    studentId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const rosterRef = doc(db, ROSTERS_COLLECTION, rosterId);

      await updateDoc(rosterRef, {
        studentIds: arrayUnion(studentId),
        updatedAt: serverTimestamp(),
      });

      return { success: true };
    } catch (error) {
      console.error('Error adding student to roster:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Remove student ID from roster
   */
  static async removeStudentFromRoster(
    rosterId: string,
    studentId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const rosterRef = doc(db, ROSTERS_COLLECTION, rosterId);

      await updateDoc(rosterRef, {
        studentIds: arrayRemove(studentId),
        updatedAt: serverTimestamp(),
      });

      return { success: true };
    } catch (error) {
      console.error('Error removing student from roster:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Bulk add students to roster
   */
  static async bulkAddStudents(
    rosterId: string,
    studentIds: string[]
  ): Promise<{
    success: boolean;
    added: number;
    skipped: number;
    errors: string[];
  }> {
    try {
      const rosterRef = doc(db, ROSTERS_COLLECTION, rosterId);
      const rosterDoc = await getDoc(rosterRef);

      if (!rosterDoc.exists()) {
        return {
          success: false,
          added: 0,
          skipped: 0,
          errors: ['Roster not found'],
        };
      }

      const currentIds = rosterDoc.data().studentIds || [];
      const uniqueNewIds = [...new Set(studentIds)];
      const idsToAdd = uniqueNewIds.filter((id) => !currentIds.includes(id));

      await updateDoc(rosterRef, {
        studentIds: arrayUnion(...idsToAdd),
        updatedAt: serverTimestamp(),
      });

      return {
        success: true,
        added: idsToAdd.length,
        skipped: uniqueNewIds.length - idsToAdd.length,
        errors: [],
      };
    } catch (error) {
      console.error('Error bulk adding students:', error);
      return {
        success: false,
        added: 0,
        skipped: 0,
        errors: [(error as Error).message],
      };
    }
  }

  /**
   * Validate student ID against master database
   */
  static async validateStudentId(
    studentId: string
  ): Promise<{ valid: boolean; exists: boolean; studentName?: string }> {
    try {
      const studentDoc = await getDoc(doc(db, STUDENTS_COLLECTION, studentId));

      if (studentDoc.exists()) {
        const data = studentDoc.data();
        return {
          valid: true,
          exists: true,
          studentName: data.name || data.fullName || '',
        };
      }

      return { valid: false, exists: false };
    } catch (error) {
      console.error('Error validating student ID:', error);
      return { valid: false, exists: false };
    }
  }

  /**
   * Bulk validate student IDs
   */
  static async bulkValidateStudentIds(
    studentIds: string[]
  ): Promise<{
    valid: string[];
    invalid: string[];
    details: Record<string, { exists: boolean; name?: string }>;
  }> {
    const valid: string[] = [];
    const invalid: string[] = [];
    const details: Record<string, { exists: boolean; name?: string }> = {};

    await Promise.all(
      studentIds.map(async (id) => {
        const result = await this.validateStudentId(id);
        details[id] = {
          exists: result.exists,
          name: result.studentName,
        };

        if (result.valid) {
          valid.push(id);
        } else {
          invalid.push(id);
        }
      })
    );

    return { valid, invalid, details };
  }

  /**
   * Parse student IDs from CSV/Excel data
   */
  static parseStudentIdsFromFile(
    data: Array<Record<string, string>>
  ): { success: boolean; studentIds?: string[]; errors?: string[] } {
    try {
      const studentIds: string[] = [];
      const errors: string[] = [];

      data.forEach((row, index) => {
        const id =
          row.studentId ||
          row.StudentID ||
          row.student_id ||
          row.id ||
          row.ID ||
          '';

        if (!id || id.trim() === '') {
          errors.push(`Row ${index + 1}: Missing student ID`);
          return;
        }

        studentIds.push(id.trim());
      });

      return {
        success: errors.length === 0,
        studentIds: errors.length === 0 ? studentIds : undefined,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      return {
        success: false,
        errors: [(error as Error).message],
      };
    }
  }

  /**
   * Export roster to CSV format
   */
  static exportRosterToCSV(roster: StudentRoster): string {
    const headers = ['Student ID', 'Status'];
    const rows = roster.studentIds.map((id) => `${id},Registered`);

    return [headers.join(','), ...rows].join('\n');
  }
}
