import React from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import BackToTop from '../components/BackToTop';
import DataMigration from '../components/DataMigration';

const MigrationPage: React.FC = () => {
  return (
    <>
      <Header />
      <main>
        <DataMigration />
      </main>
      <Footer />
      <BackToTop />
    </>
  );
};

export default MigrationPage; 