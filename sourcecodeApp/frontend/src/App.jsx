/*
 * PGH-DOC
 * File: src/App.jsx
 * Apa fungsi bagian ini:
 * - File ini mendukung rendering frontend agar fitur berjalan stabil dan konsisten.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import React from 'react';
import Routers from './Route';
import ChartistProvider from './_helper/Chartist/ChartistProvider';
import ChartjsProvider from './_helper/Chartjs/ChartProvider';
import GoogleChartProvider from './_helper/GoogleChart/GoogleChartProvider';
import ProjectProvider from './_helper/Project/ProjectProvider';
import ChatProvider from './_helper/Chat/ChatProvider';
import ContactProvider from './_helper/Contact/ContactProvider';
import TaskProvider from './_helper/Task/TaskProvider';
import GalleryProvider from './_helper/Gallery/GalleryProvider';
import TableProvider from './_helper/Table/TableProvider';
import BookmarkProvider from './_helper/Bookmark/BookmarkProvider';
import TodoProvider from './_helper/Todo/TodoProvider';
import ProductProvider from './_helper/Ecommerce/Product/ProductProvider';
import CartProvider from './_helper/Ecommerce/Cart/CardProvider';
import FilterProvider from './_helper/Ecommerce/Filter/FilterProvider';
import WishListProvider from './_helper/Ecommerce/Wishlist/WishlistProvider';
import JobSearchProvider from './_helper/JobSearch/JobSearchProvider';
import LearningProvider from './_helper/Learning/LearningProvider';
import FaqProvider from './_helper/Faq/FaqProvider';
import AnimationThemeProvider from './_helper/AnimationTheme/AnimationThemeProvider';
import CustomizerProvider from './_helper/Customizer/CustomizerProvider';


import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const App = () => (
  <div className="App">
     {/* 🔥 Make Toast available everywhere */}
    <ToastContainer
      position="top-right"
      autoClose={3000}
      pauseOnFocusLoss={false}
      pauseOnHover={true}
      closeOnClick
      draggable
      limit={5}
    />
    <CustomizerProvider>
      <FaqProvider>
        <LearningProvider>
          <JobSearchProvider>
              <WishListProvider>
                <FilterProvider>
                  <CartProvider>
                    <ProductProvider>
                      <TodoProvider>
                        <BookmarkProvider>
                          <TableProvider>
                            <GalleryProvider>
                              <TaskProvider>
                                <ContactProvider>
                                  <ChatProvider>
                                    <ProjectProvider>
                                      <GoogleChartProvider>
                                        <ChartjsProvider>
                                          <ChartistProvider>
                                            <AnimationThemeProvider>
                                              <Routers />
                                            </AnimationThemeProvider>
                                          </ChartistProvider>
                                        </ChartjsProvider>
                                      </GoogleChartProvider>
                                    </ProjectProvider>
                                  </ChatProvider>
                                </ContactProvider>
                              </TaskProvider>
                            </GalleryProvider>
                          </TableProvider>
                        </BookmarkProvider>
                      </TodoProvider>
                    </ProductProvider>
                  </CartProvider>
                </FilterProvider>
              </WishListProvider>
          </JobSearchProvider>
        </LearningProvider>
      </FaqProvider>
    </CustomizerProvider>
  </div>
);

export default App;
